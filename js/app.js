const STAFF_CODE = "102030";
const STORE_KEY = "lostFoundItems";

let items = load();
let currentPhoto = "";
let claimingId = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const $ = sel => document.querySelector(sel);
const gallery = $("#gallery");
const emptyState = $("#empty");
const staffList = $("#staff-list");

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
      ? `<img src="${it.photo}" alt="${esc(it.type)}" />`
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
      ? `<img class="staff-thumb" src="${it.photo}" alt="" />`
      : `<div class="staff-thumb">No photo</div>`;
    const meta = [it.brand, it.color, it.size && "Size " + it.size].filter(Boolean).join(" · ");
    const status = it.claimed
      ? `Claimed by ${esc(it.claimedBy)} (${esc(it.claimedClass)})`
      : "Available";
    row.innerHTML = `
      ${thumb}
      <div class="staff-info">
        <h4>${esc(it.type)}</h4>
        <p>${esc(meta) || "No tags"}</p>
        <p>${status}</p>
      </div>
      <div class="staff-actions">
        ${it.claimed ? `<button class="btn ghost small" data-reset="${it.id}">Unclaim</button>` : ""}
        <button class="btn danger small" data-del="${it.id}">Delete</button>
      </div>`;
    staffList.appendChild(row);
  });

  staffList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      items = items.filter(i => i.id !== btn.dataset.del);
      save();
      renderAll();
      toast("Item deleted", "warn");
    });
  });
  staffList.querySelectorAll("[data-reset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const it = items.find(i => i.id === btn.dataset.reset);
      if (it) {
        it.claimed = false;
        it.claimedBy = "";
        it.claimedClass = "";
        save();
        renderAll();
        toast("Item marked available");
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

let codeBuffer = "";
document.addEventListener("keydown", e => {
  if (e.target.matches("input, textarea")) return;
  if (!/^\d$/.test(e.key)) return;
  codeBuffer = (codeBuffer + e.key).slice(-STAFF_CODE.length);
  if (codeBuffer === STAFF_CODE) {
    codeBuffer = "";
    switchView("staff");
    renderStaffList();
  }
});

$("#lock-btn").addEventListener("click", () => switchView("gallery"));

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

$("#add-form").addEventListener("submit", e => {
  e.preventDefault();
  const type = $("#in-type").value;
  if (!type) return;
  items.unshift({
    id: uid(),
    type,
    brand: $("#in-brand").value.trim(),
    color: $("#in-color").value.trim(),
    size: $("#in-size").value.trim(),
    location: $("#in-location").value.trim(),
    notes: $("#in-notes").value.trim(),
    photo: currentPhoto,
    claimed: false,
    claimedBy: "",
    claimedClass: "",
    added: Date.now()
  });
  save();
  e.target.reset();
  clearPhoto();
  renderAll();
  toast("Item added to gallery");
});

function openClaim(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  claimingId = id;
  const preview = it.photo
    ? `<img src="${it.photo}" alt="" />`
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

$("#claim-submit").addEventListener("click", () => {
  const name = $("#claim-name").value.trim();
  const cls = $("#claim-class").value.trim().toUpperCase();
  const err = $("#claim-error");

  if (!name) {
    err.textContent = "Please enter your name.";
    err.classList.remove("hidden");
    return;
  }
  if (!/^([1-9]|1[0-2])[A-F]$/.test(cls)) {
    err.textContent = "Enter a valid class like 8B (grade 1–12, letter A–F).";
    err.classList.remove("hidden");
    return;
  }

  const it = items.find(i => i.id === claimingId);
  if (it) {
    it.claimed = true;
    it.claimedBy = name;
    it.claimedClass = cls;
    save();
    renderAll();
  }
  closeClaim();
  toast("Claimed! Please collect it from staff.");
});

$("#claim-class").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase();
});

let toastTimer;
function toast(msg, kind) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (kind ? " " + kind : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

renderAll();
