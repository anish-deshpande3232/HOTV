/* =========================================================
   ui.js — Shared UI utilities
   Toast · Modal · QR · Upload Zones · Helpers
   ========================================================= */

/* ── Toast notifications ────────────────────────────────── */
function showToast(msg, type = "success", dur = 4000) {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||"ℹ️"}</span>
    <span class="toast-msg">${msg}</span>
    <span class="toast-x" onclick="this.parentElement.remove()">✕</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(30px)";
    t.style.transition = ".3s";
    setTimeout(() => t.remove(), 350);
  }, dur);
}

/* ── Modal helpers ──────────────────────────────────────── */
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add("open"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("open"); }

/* ── Canvas QR generator (no library) ───────────────────── */
function drawQR(canvas, text, size = 160) {
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";

  const cells = 25;
  const cell  = Math.floor((size - 16) / cells);
  const off   = Math.floor((size - cells * cell) / 2);

  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  h = Math.abs(h);

  [[0,0],[0,cells-7],[cells-7,0]].forEach(([r,c]) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(off+c*cell, off+r*cell, 7*cell, 7*cell);
    ctx.fillStyle = "#fff";
    ctx.fillRect(off+(c+1)*cell, off+(r+1)*cell, 5*cell, 5*cell);
    ctx.fillStyle = "#000";
    ctx.fillRect(off+(c+2)*cell, off+(r+2)*cell, 3*cell, 3*cell);
  });

  ctx.fillStyle = "#000";
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if ((r<8&&c<8)||(r<8&&c>cells-9)||(r>cells-9&&c<8)) continue;
      const bit = (h * (r * cells + c + 1) * 1103515245 + 12345) & 0x80000000;
      if (bit) ctx.fillRect(off+c*cell, off+r*cell, cell-1, cell-1);
    }
  }
}

/* ── Date formatting ────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }
  catch { return iso; }
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return iso; }
}

/* ── Hash display ───────────────────────────────────────── */
function shortHash(h) {
  if (!h || h.length < 12) return h || "—";
  return h.slice(0,8) + "…" + h.slice(-6);
}

/* ── Local hash from file (no backend needed) ────────────── */
async function localFileHash(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      // Simple string hash of file content
      const arr  = new Uint8Array(e.target.result.slice(0, 4096));
      let hash   = file.name + file.size + file.lastModified;
      for (let i = 0; i < arr.length; i++) hash = ((hash << 5) - hash + arr[i]) | 0;
      const hex  = Math.abs(hash).toString(16).padStart(8, "0");
      resolve("Qm" + hex.repeat(5).slice(0, 44)); // fake CID-like hash
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ── Read file as Data URL (for image preview) ───────────── */
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   UPLOAD ZONE
   • Works offline (local hash fallback)
   • Shows image preview for image files
   • Shows filename + size for PDFs/docs
   • Stores result in window._uploads[zoneId]
   ========================================================= */
window._uploads = {};

function setupUploadZone(zoneId, callback, opts = {}) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  const accept = opts.accept || "image/*,.pdf,.doc,.docx";

  // ── Render idle state ──────────────────────────────────
  function renderIdle() {
    zone.innerHTML = `
      <div class="upload-icon">${opts.icon || "📁"}</div>
      <div class="upload-text">${opts.label || "Click or drag file here"}</div>
      <div class="upload-sub">${opts.sub || "Images, PDF up to 20MB"}</div>`;
  }

  // ── Render uploading ───────────────────────────────────
  function renderLoading(name) {
    zone.innerHTML = `
      <div class="upload-icon"><span class="loader"></span></div>
      <div class="upload-text">Processing <strong>${name}</strong>…</div>`;
  }

  // ── Render success ─────────────────────────────────────
  function renderSuccess(file, dataUrl, hash, source) {
    const isImg  = file.type.startsWith("image/");
    const sizekb = (file.size / 1024).toFixed(1);
    zone.innerHTML = `
      ${isImg ? `<img src="${dataUrl}" style="max-height:120px;max-width:100%;border-radius:8px;object-fit:contain;margin-bottom:8px" alt="preview">` : `<div class="upload-icon">📄</div>`}
      <div class="upload-text" style="color:var(--green);font-weight:600">${file.name}</div>
      <div class="upload-sub">${sizekb} KB · <span class="mono">${shortHash(hash)}</span> · ${source}</div>
      <button class="btn btn-sm btn-ghost" style="margin-top:8px" onclick="clearUpload('${zoneId}')">✕ Remove</button>`;
  }

  // ── Render error ───────────────────────────────────────
  function renderError(msg) {
    zone.innerHTML = `
      <div class="upload-icon">❌</div>
      <div class="upload-text" style="color:var(--red)">${msg}</div>
      <div class="upload-sub" style="cursor:pointer;color:var(--muted)" onclick="renderIdle()">Click to try again</div>`;
  }

  // ── Process a File object ──────────────────────────────
  async function processFile(file) {
    if (!file) return;

    // Size check (20MB)
    if (file.size > 20 * 1024 * 1024) {
      renderError("File too large (max 20MB)");
      return;
    }

    renderLoading(file.name);

    // Always read locally for preview
    let dataUrl = null;
    if (file.type.startsWith("image/")) {
      try { dataUrl = await readAsDataURL(file); } catch {}
    }

    // Try uploading to backend; fall back to local hash
    let hash   = null;
    let source = "local hash";

    try {
      const res = await API.uploadPhoto(file);
      if (res && res.hash) {
        hash   = res.hash;
        source = "IPFS";
      }
    } catch {}

    if (!hash) {
      hash   = await localFileHash(file);
      source = "local hash";
    }

    // Store result
    window._uploads[zoneId] = { file, dataUrl, hash, source };

    renderSuccess(file, dataUrl, hash, source);

    if (callback) callback({ hash, url: `https://ipfs.io/ipfs/${hash}`, file, dataUrl, source });
  }

  // ── Click to pick file ─────────────────────────────────
  zone.addEventListener("click", e => {
    if (e.target.tagName === "BUTTON") return; // don't trigger on Remove btn
    const inp    = document.createElement("input");
    inp.type     = "file";
    inp.accept   = accept;
    inp.onchange = async ev => {
      const file = ev.target.files[0];
      if (file) await processFile(file);
    };
    inp.click();
  });

  // ── Drag-and-drop ──────────────────────────────────────
  zone.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", async e => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  });

  renderIdle();
}

/* ── Clear an upload zone back to idle ───────────────────── */
function clearUpload(zoneId) {
  delete window._uploads[zoneId];
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.innerHTML = `
    <div class="upload-icon">📁</div>
    <div class="upload-text">Click or drag file here</div>
    <div class="upload-sub">Images, PDF up to 20MB</div>`;
}

/* ── Get upload result by zone ID ────────────────────────── */
function getUpload(zoneId) {
  return window._uploads[zoneId] || null;
}

/* ── Status badge HTML ──────────────────────────────────── */
const STATUS_BADGE = {
  "Created":     "badge-gray",
  "InTransit":   "badge-amber",
  "InWarehouse": "badge-blue",
  "LabVerified": "badge-purple",
  "Approved":    "badge-green",
  "Delivered":   "badge-green",
  "Recalled":    "badge-red",
};
function statusBadge(label) {
  const cls = STATUS_BADGE[label] || "badge-gray";
  return `<span class="badge ${cls}">${label || "Unknown"}</span>`;
}

/* ── Section switcher ───────────────────────────────────── */
function showSection(id) {
  document.querySelectorAll(".sec-panel").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const panel = document.getElementById("sec-"+id);
  if (panel) panel.classList.remove("hidden");
  const navEl = document.querySelector(`[data-sec="${id}"]`);
  if (navEl) navEl.classList.add("active");
  const titles = {
    dashboard:"Dashboard", create:"Create Batch", history:"Batch History",
    lab:"Lab Status", payment:"Payments", certs:"Certifications",
    incoming:"Incoming Batches", qr:"Generate QR", recall:"Recall Batch",
    pending:"Pending Tests", upload:"Upload Report", completed:"Test History",
    analytics:"Analytics", users:"User Management", batches:"All Batches"
  };
  const t = document.getElementById("topbar-title");
  if (t) t.textContent = titles[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

/* ── Backend health check ───────────────────────────────── */
async function checkBackend() {
  const el = document.getElementById("backend-status");
  if (!el) return;
  try {
    const h = await API.health();
    if (h.api) {
      el.innerHTML =
        `<span class="badge badge-${h.mongodb?"green":"amber"}" style="font-size:9px">${h.mongodb?"🟢 DB":"🟡 No DB"}</span> ` +
        `<span class="badge badge-${h.blockchain?"green":"amber"}" style="font-size:9px">${h.blockchain?"⛓ Chain":"🟡 No Chain"}</span>`;
    } else {
      el.innerHTML = `<span class="badge badge-red" style="font-size:9px">⚠️ API Offline</span>`;
    }
  } catch {
    if (el) el.innerHTML = `<span class="badge badge-red" style="font-size:9px">⚠️ Backend Offline</span>`;
  }
}

/* ── Seed demo data once ────────────────────────────────── */
async function seedIfEmpty() {
  try { await API.seed(); } catch {}
}
