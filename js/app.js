const STAFF_CODE = "102030";
const STORAGE_KEY = "lostandfound-items";

let items = [];
let currentPhoto = "";
let claimingId = null;
let store;
let storageMode = "server";

function esc(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const $ = sel => document.querySelector(sel);
const gallery = $("#gallery");
const emptyState = $("#empty");
const staffList = $("#staff-list");
const storageBanner = $("#storage-banner");

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
  } catch (error) {
    error.apiUnavailable = true;
    throw error;
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function isApiUnavailable(error) {
  const hostParts = window.location.hostname.split(".");
  const isGitHubPages = hostParts.length >= 2 && hostParts.slice(-2).join(".") === "github.io";
  const isStaticHost = window.location.protocol === "file:" || isGitHubPages;
  return Boolean(error?.apiUnavailable) || error?.status >= 500 || (isStaticHost && error?.status === 404);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortItems(list) {
  return [...list].sort((a, b) => (b.added || 0) - (a.added || 0));
}

function normalizeItem(item) {
  return {
    id: item.id || createId(),
    type: item.type || "",
    brand: item.brand || "",
    color: item.color || "",
    size: item.size || "",
    location: item.location || "",
    notes: item.notes || "",
    photo: item.photo || "",
    claimed: Boolean(item.claimed),
    claimedBy: item.claimedBy || "",
    claimedClass: item.claimedClass || "",
    added: item.added || Date.now()
  };
}

function readLocalItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? sortItems(parsed.map(normalizeItem)) : [];
  } catch {
    return [];
  }
}

function writeLocalItems(nextItems) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortItems(nextItems).map(normalizeItem)));
}

function createLocalStore() {
  return {
    async list() {
      return readLocalItems();
    },
    async add(payload) {
      if (!payload.type) throw new Error("Missing required fields.");
      const nextItem = normalizeItem({
        ...payload,
        id: createId(),
        claimed: false,
        claimedBy: "",
        claimedClass: "",
        added: Date.now()
      });
      const nextItems = [nextItem, ...readLocalItems()];
      writeLocalItems(nextItems);
      return nextItem;
    },
    async claim(id, payload) {
      const nextItems = readLocalItems();
      const item = nextItems.find(entry => entry.id === id);
      if (!item) throw new Error("Item not found.");
      if (item.claimed) throw new Error("Item has already been claimed.");
      item.claimed = true;
      item.claimedBy = payload.claimedBy || "";
      item.claimedClass = payload.claimedClass || "";
      writeLocalItems(nextItems);
      return normalizeItem(item);
    },
    async unclaim(id) {
      const nextItems = readLocalItems();
      const item = nextItems.find(entry => entry.id === id);
      if (!item) throw new Error("Item not found.");
      item.claimed = false;
      item.claimedBy = "";
      item.claimedClass = "";
      writeLocalItems(nextItems);
      return normalizeItem(item);
    },
    async remove(id) {
      const nextItems = readLocalItems();
      const itemExists = nextItems.some(entry => entry.id === id);
      if (!itemExists) throw new Error("Item not found.");
      writeLocalItems(nextItems.filter(entry => entry.id !== id));
    }
  };
}

async function initStore() {
  try {
    const initialItems = await api("/api/items");
    storageMode = "server";
    return {
      initialItems,
      client: {
        list: () => api("/api/items"),
        add: payload => api("/api/items", {
          method: "POST",
          body: JSON.stringify(payload)
        }),
        claim: (id, payload) => api(`/api/items/${id}/claim`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        }),
        unclaim: id => api(`/api/items/${id}/unclaim`, { method: "PATCH" }),
        remove: id => api(`/api/items/${id}`, { method: "DELETE" })
      }
    };
  } catch (error) {
    if (!isApiUnavailable(error)) {
      throw error;
    }
    storageMode = "local";
    return {
      initialItems: readLocalItems(),
      client: createLocalStore()
    };
  }
}

function updateStorageBanner() {
  if (storageMode === "local") {
    storageBanner.classList.remove("hidden");
    storageBanner.textContent = "GitHub Pages mode: items are saved only in this browser.";
    storageBanner.classList.add("local");
    return;
  }
  storageBanner.classList.add("hidden");
  storageBanner.classList.remove("local");
  storageBanner.textContent = "";
}

async function loadItems() {
  items = await store.list();
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
      ? `Claimed by ${it.claimedBy} (${it.claimedClass})`
      : "Available";
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
        await store.remove(btn.dataset.del);
        await loadItems();
        renderAll();
        toast("Item deleted", "warn");
      } catch (err) {
        toast(err.message || "Failed to delete item", "err");
      }
    });
  });

  staffList.querySelectorAll("[data-reset]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await store.unclaim(btn.dataset.reset);
        await loadItems();
        renderAll();
        toast("Item marked available");
      } catch (err) {
        toast(err.message || "Failed to update item", "err");
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

$("#add-form").addEventListener("submit", async e => {
  e.preventDefault();
  const type = $("#in-type").value;
  if (!type) return;

  const payload = {
    type,
    brand: $("#in-brand").value.trim(),
    color: $("#in-color").value.trim(),
    size: $("#in-size").value.trim(),
    location: $("#in-location").value.trim(),
    notes: $("#in-notes").value.trim(),
    photo: currentPhoto
  };

  try {
    await store.add(payload);
    await loadItems();
    e.target.reset();
    clearPhoto();
    renderAll();
    toast("Item added to gallery");
  } catch (err) {
    toast(err.message || "Failed to add item", "err");
  }
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

$("#claim-submit").addEventListener("click", async () => {
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

  try {
    await store.claim(claimingId, {
      claimedBy: name,
      claimedClass: cls
    });
    await loadItems();
    renderAll();
    closeClaim();
    toast("Claimed! Please collect it from staff.");
  } catch (error) {
    err.textContent = error.message || "Failed to claim item.";
    err.classList.remove("hidden");
  }
});

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
    const { initialItems, client } = await initStore();
    store = client;
    items = initialItems;
    updateStorageBanner();
    renderAll();
    if (storageMode === "local") {
      toast("Running without a server. Data stays in this browser.", "warn");
    }
  } catch (err) {
    toast("Could not start the app.", "err");
  }
}

init();
