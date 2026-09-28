import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, addDoc, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig, STAFF_DOMAIN, LIVE_HOST } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Local copies of the site talk to `firebase emulators:start`, never the live database.
if (location.hostname !== LIVE_HOST) {
  connectFirestoreEmulator(db, location.hostname, 8080);
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
}

let items = [];
let currentPhoto = "";
let claimingId = null;
let isStaff = false;

function esc(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const $ = sel => document.querySelector(sel);
const gallery = $("#gallery");
const emptyState = $("#empty");
const staffList = $("#staff-list");

// Claimer names live in a separate staff-only collection (see firestore.rules).
async function loadItems() {
  const snap = await getDocs(query(collection(db, "items"), orderBy("added", "desc")));
  items = snap.docs.map(d => ({ id: d.id, ...d.data(), claimedBy: "", claimedClass: "" }));
  if (isStaff) {
    const claims = await getDocs(collection(db, "claims"));
    const byId = new Map(claims.docs.map(d => [d.id, d.data()]));
    items.forEach(it => Object.assign(it, byId.get(it.id)));
  }
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + view).classList.add("active");
}

function renderGallery() {
  const term = $("#search").value.trim().toLowerCase();
  const typeF = $("#filter-type").value;
  const statusF = $("#filter-status").value;

  const filtered = items.filter(it => {
    if (statusF === "available" && it.claimed) return false;
    if (statusF === "claimed" && !it.claimed) return false;
    if (typeF && it.type !== typeF) return false;
    if (term) {
      const hay = [it.type, it.brand, it.color, it.size, it.location, it.notes].join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  gallery.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach(it => {
    const card = document.createElement("div");
    card.className = "card";
    const img = it.photo
      ? `<img src="${esc(it.photo)}" alt="${esc(it.type)}" />`
      : `<div class="no-img">No photo</div>`;
    const statusClass = it.claimed ? "claimed" : "available";
    const statusText = it.claimed ? "Claimed" : "Available";

    const tags = [];
    if (it.brand) tags.push(`<span class="tag brand">${esc(it.brand)}</span>`);
    if (it.color) tags.push(`<span class="tag color">${esc(it.color)}</span>`);
    if (it.size) tags.push(`<span class="tag">Size ${esc(it.size)}</span>`);
    if (it.location) tags.push(`<span class="tag">${esc(it.location)}</span>`);

    const foot = it.claimed
      ? `<div class="card-foot"><div class="claimed-by">CLAIMED</div></div>`
      : `<div class="card-foot"><button class="btn primary" data-claim="${it.id}">Claim this</button></div>`;

    card.innerHTML = `
      <div class="card-img">
        ${img}
        <span class="status-chip ${statusClass}">${statusText}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(it.type)}</h3>
        <div class="tag-row">${tags.join("")}</div>
        ${it.notes ? `<p class="card-note">${esc(it.notes)}</p>` : ""}
        ${foot}
      </div>`;
    gallery.appendChild(card);
  });

  gallery.querySelectorAll("[data-claim]").forEach(btn => {
    btn.addEventListener("click", () => openClaim(btn.dataset.claim));
  });
}

function renderStaffList() {
  $("#count-badge").textContent = items.length;
  staffList.innerHTML = "";
  if (!items.length) {
    staffList.innerHTML = `<p class="hint">No items added yet.</p>`;
    return;
  }
  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "staff-row";
    const thumb = it.photo
      ? `<img class="staff-thumb" src="${esc(it.photo)}" alt="" />`
      : `<div class="staff-thumb">No photo</div>`;
    const meta = [it.brand, it.color, it.size && "Size " + it.size].filter(Boolean).join(" · ");
    const status = !it.claimed
      ? "Available"
      : it.claimedBy ? `Claimed by ${it.claimedBy} (${it.claimedClass})` : "Claimed";
    row.innerHTML = `
      ${thumb}
      <div class="staff-info">
        <h4>${esc(it.type)}</h4>
        <p>${esc(meta) || "No tags"}</p>
        <p>${esc(status)}</p>
      </div>
      <div class="staff-actions">
        ${it.claimed ? `<button class="btn ghost small" data-reset="${it.id}">Unclaim</button>` : ""}
        <button class="btn danger small" data-del="${it.id}">Delete</button>
      </div>`;
    staffList.appendChild(row);
  });

  staffList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "items", btn.dataset.del));
        batch.delete(doc(db, "claims", btn.dataset.del));
        await batch.commit();
        await loadItems();
        renderAll();
        toast("Item deleted", "warn");
      } catch (err) {
        console.error(err);
        toast("Failed to delete item", "err");
      }
    });
  });

  staffList.querySelectorAll("[data-reset]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, "items", btn.dataset.reset), { claimed: false });
        batch.delete(doc(db, "claims", btn.dataset.reset));
        await batch.commit();
        await loadItems();
        renderAll();
        toast("Item marked available");
      } catch (err) {
        console.error(err);
        toast("Failed to update item", "err");
      }
    });
  });
}

function renderAll() {
  renderGallery();
  renderStaffList();
}

$("#search").addEventListener("input", renderGallery);
$("#filter-type").addEventListener("change", renderGallery);
$("#filter-status").addEventListener("change", renderGallery);

function isStaffAccount(user) {
  return Boolean(user?.email?.toLowerCase().endsWith("@" + STAFF_DOMAIN));
}

onAuthStateChanged(auth, user => {
  isStaff = isStaffAccount(user);
});

async function showStaff() {
  try {
    await loadItems();
    renderAll();
    switchView("staff");
  } catch (err) {
    console.error(err);
    toast("Could not load staff view", "err");
  }
}

$("#staff-btn").addEventListener("click", () => {
  if (isStaff) showStaff();
  else openLogin();
});

function openLogin() {
  $("#login-password").value = "";
  $("#login-error").classList.add("hidden");
  $("#login-modal").classList.remove("hidden");
  ($("#login-email").value ? $("#login-password") : $("#login-email")).focus();
}

function closeLogin() {
  $("#login-modal").classList.add("hidden");
}

$("#login-close").addEventListener("click", closeLogin);
$("#login-modal").addEventListener("click", e => {
  if (e.target === $("#login-modal")) closeLogin();
});

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#login-error");
  try {
    const { user } = await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    if (!isStaffAccount(user)) {
      await signOut(auth);
      err.textContent = `Staff accounts use an @${STAFF_DOMAIN} email.`;
      err.classList.remove("hidden");
      return;
    }
    isStaff = true;
    closeLogin();
    await showStaff();
  } catch (error) {
    err.textContent = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
      "auth/network-request-failed": "No connection. Check your internet and try again."
    }[error.code] || "Wrong email or password.";
    err.classList.remove("hidden");
  }
});

$("#lock-btn").addEventListener("click", async () => {
  await signOut(auth);
  isStaff = false;
  switchView("gallery");
  try {
    await loadItems();
    renderAll();
  } catch (err) {
    console.error(err);
  }
});

$("#photo-input").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    resizeImage(reader.result, 900, dataUrl => {
      currentPhoto = dataUrl;
      $("#photo-preview").src = dataUrl;
      $("#photo-preview").classList.remove("hidden");
      $("#photo-placeholder").classList.add("hidden");
      $("#clear-photo").classList.remove("hidden");
    });
  };
  reader.readAsDataURL(file);
});

$("#clear-photo").addEventListener("click", clearPhoto);

function clearPhoto() {
  currentPhoto = "";
  $("#photo-input").value = "";
  $("#photo-preview").src = "";
  $("#photo-preview").classList.add("hidden");
  $("#photo-placeholder").classList.remove("hidden");
  $("#clear-photo").classList.add("hidden");
}

function resizeImage(src, max, cb) {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    if (width > height && width > max) {
      height = height * (max / width);
      width = max;
    } else if (height > max) {
      width = width * (max / height);
      height = max;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    cb(canvas.toDataURL("image/jpeg", 0.82));
  };
  img.src = src;
}

$("#add-form").addEventListener("submit", async e => {
  e.preventDefault();
  const type = $("#in-type").value;
  if (!type) return;

  const item = {
    type,
    brand: $("#in-brand").value.trim(),
    color: $("#in-color").value.trim(),
    size: $("#in-size").value.trim(),
    location: $("#in-location").value.trim(),
    notes: $("#in-notes").value.trim(),
    photo: currentPhoto,
    claimed: false,
    added: Date.now()
  };

  try {
    await addDoc(collection(db, "items"), item);
    await loadItems();
    e.target.reset();
    clearPhoto();
    renderAll();
    toast("Item added to gallery");
  } catch (err) {
    console.error(err);
    toast("Failed to add item", "err");
  }
});

function openClaim(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  claimingId = id;
  const preview = it.photo
    ? `<img src="${esc(it.photo)}" alt="" />`
    : `<div class="cp-icon">No photo</div>`;
  const meta = [it.brand, it.color].filter(Boolean).join(" · ") || "No tags";
  $("#claim-preview").innerHTML = `${preview}<div><h4>${esc(it.type)}</h4><p>${esc(meta)}</p></div>`;
  $("#claim-name").value = "";
  $("#claim-class").value = "";
  $("#claim-error").classList.add("hidden");
  $("#claim-modal").classList.remove("hidden");
}

$("#claim-close").addEventListener("click", closeClaim);
$("#claim-modal").addEventListener("click", e => {
  if (e.target === $("#claim-modal")) closeClaim();
});

function closeClaim() {
  $("#claim-modal").classList.add("hidden");
  claimingId = null;
}

$("#claim-submit").addEventListener("click", async () => {
  const id = claimingId;
  const name = $("#claim-name").value.trim();
  const cls = $("#claim-class").value.trim().toUpperCase();
  const err = $("#claim-error");

  if (!name) {
    err.textContent = "Please enter your name.";
    err.classList.remove("hidden");
    return;
  }
  if (name.length > 100) {
    err.textContent = "Please shorten your name to 100 characters or fewer.";
    err.classList.remove("hidden");
    return;
  }
  if (!/^([1-9]|1[0-2])[A-F]$/.test(cls)) {
    err.textContent = "Enter a valid class like 8B (grade 1–12, letter A–F).";
    err.classList.remove("hidden");
    return;
  }

  try {
    // Both writes succeed together or not at all; the rules reject a second claim.
    const batch = writeBatch(db);
    batch.update(doc(db, "items", id), { claimed: true });
    batch.set(doc(db, "claims", id), { claimedBy: name, claimedClass: cls });
    await batch.commit();
    await loadItems();
    renderAll();
    closeClaim();
    toast("Claimed! Please collect it from staff.");
  } catch (error) {
    console.error(error);
    err.textContent = await claimFailureMessage(id, error);
    err.classList.remove("hidden");
    loadItems().then(renderAll).catch(() => {});
  }
});

// The input is validated above, so a rejected claim usually means the item changed
// since the page loaded. Look it up so the message says what actually happened.
async function claimFailureMessage(id, error) {
  if (error.code !== "permission-denied") return "Failed to claim item. Please try again.";
  try {
    const snap = await getDoc(doc(db, "items", id));
    if (!snap.exists()) return "Sorry, this item is no longer listed.";
    if (snap.data().claimed) return "Sorry, this item has already been claimed.";
  } catch (lookupError) {
    console.error(lookupError);
  }
  return "This item couldn't be claimed. Please ask a staff member.";
}

$("#claim-class").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase();
});

let toastTimer;
function toast(msg, kind) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (kind ? " " + kind : "");
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

async function init() {
  try {
    await loadItems();
    renderAll();
  } catch (err) {
    console.error(err);
    toast("Could not connect to the database.", "err");
  }
}

init();
