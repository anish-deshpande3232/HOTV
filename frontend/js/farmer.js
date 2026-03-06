/* =========================================================
   farmer.js — Farmer Dashboard Logic
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireRole(["farmer"])) return;
  populateSidebarUser();
  const n = document.getElementById("farmer-name");
  if (n) n.textContent = getUserName();
  checkBackend();
  await seedIfEmpty();
  showSection("dashboard");
  loadStats();
  loadBatches();
  loadLabStatus();
  setupCreateForm();
  setupIndustrySwitch();
  Blockchain.updateBadge();

  // Setup upload zones with proper icons/labels
  setupUploadZone("photo-upload-zone", (res) => {
    window._photoUpload = res;
    showToast("Photo ready — " + (res.source === "IPFS" ? "pinned to IPFS" : "stored locally"), "success");
  }, { icon:"📷", label:"Click or drag product photo here", sub:"JPEG, PNG, WEBP up to 20MB", accept:"image/*" });

  setupUploadZone("cert-upload-zone", (res) => {
    window._certUpload = res;
    showToast("Certificate ready — " + (res.source === "IPFS" ? "pinned to IPFS" : "stored locally"), "success");
  }, { icon:"📜", label:"Click or drag certification document here", sub:"PDF, PNG, JPEG up to 20MB", accept:"image/*,.pdf" });

  setupUploadZone("cert-up2", (res) => {
    window._certUp2 = res;
    showToast("Certificate uploaded!", "success");
  }, { icon:"📜", label:"Click or drag certificate file here", sub:"PDF or image up to 20MB", accept:"image/*,.pdf" });
});

/* ── Stats ──────────────────────────────────────────────── */
async function loadStats() {
  try {
    const { batches = [] } = await API.getAllBatches().catch(() => ({ batches: [] }));
    setText("stat-total",    batches.length);
    setText("stat-approved", batches.filter(b => b.status >= 4).length);
    setText("stat-pending",  batches.filter(b => b.status > 0 && b.status < 4 && !b.isRecalled).length);
    setText("stat-recalled", batches.filter(b => b.isRecalled).length);

    const el = document.getElementById("recent-activity");
    if (el) {
      el.innerHTML = batches.slice(0, 5).map(b => `
        <div class="flex f-center f-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div class="fw-600 text-sm">${b.productName || "—"}</div>
            <div class="text-xs text-muted mono">${b.displayId || shortHash(b.batchId) || "—"}</div>
          </div>
          ${statusBadge(b.statusLabel || "Created")}
        </div>`).join("") || `<p class="text-muted text-sm" style="padding:16px 0">No batches yet</p>`;
    }
  } catch {}
}

/* ── Create Batch Form ──────────────────────────────────── */
function setupCreateForm() {
  const form = document.getElementById("batch-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    btn.innerHTML = '<span class="loader"></span> Creating on blockchain…';
    btn.disabled  = true;

    // Get upload hashes — use whatever we have (IPFS or local hash)
    const photoUpload = getUpload("photo-upload-zone");
    const certUpload  = getUpload("cert-upload-zone");

    const payload = {
      displayId:    "BATCH-" + Date.now().toString(36).toUpperCase(),
      productName:  val("productName"),
      producerName: getUserName(),
      origin:       val("origin"),
      industryType: parseInt(val("industryType")) || 0,
      quantity:     parseFloat(val("quantity")) || 0,
      unit:         val("unit") || "kg",
      harvestDate:  val("harvestDate"),
      expiryDate:   val("expiryDate"),
      certNumber:   val("certNumber"),
      notes:        val("notes"),
      pesticides:   val("pesticides"),
      dosage:       val("dosage"),
      license:      val("license"),
      photoHash:    photoUpload?.hash  || "",
      metadataHash: certUpload?.hash   || ""
    };

    if (!payload.productName) {
      showToast("Product name is required", "warning");
      btn.innerHTML = "🌱 Create Batch";
      btn.disabled  = false;
      return;
    }

    try {
      const res = await API.createBatch(payload);
      if (res.success) {
        // Show success card
        const successCard = document.getElementById("batch-success");
        if (successCard) successCard.classList.remove("hidden");
        setText("created-id",   res.displayId || res.batchId);
        setText("created-tx",   shortHash(res.txHash));
        setText("created-ipfs", shortHash(res.metadataHash));

        // Draw QR
        const qc = document.getElementById("created-qr");
        if (qc) drawQR(qc, res.displayId || res.batchId, 120);
        setText("created-qr-id", res.displayId || res.batchId);

        showToast(`✅ Batch ${res.displayId} created! ${res.chainOK ? "Recorded on-chain." : "Saved to DB."}`, "success", 6000);
        form.reset();
        setupIndustrySwitch(); // re-hide/show fields after reset
        loadBatches();
        loadStats();
      } else {
        showToast("Error: " + (res.error || "Unknown error"), "error");
      }
    } catch (err) {
      showToast("Backend offline — " + err.message, "error");
    } finally {
      btn.innerHTML = "🌱 Create Batch";
      btn.disabled  = false;
    }
  });
}

/* ── Industry field switcher ────────────────────────────── */
function setupIndustrySwitch() {
  const sel = document.getElementById("industryType");
  if (!sel) return;
  function update() {
    const isPharma = sel.value === "1";
    document.querySelectorAll(".agri-field").forEach(el   => el.classList.toggle("hidden", isPharma));
    document.querySelectorAll(".pharma-field").forEach(el => el.classList.toggle("hidden", !isPharma));
  }
  sel.addEventListener("change", update);
  update();
}

/* ── Batch History Table ────────────────────────────────── */
async function loadBatches() {
  const tbody = document.getElementById("batch-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)"><span class="loader"></span></td></tr>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    if (!batches.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">No batches yet — create your first!</td></tr>`;
      return;
    }
    tbody.innerHTML = batches.map(b => `
      <tr>
        <td><span class="mono">${b.displayId || shortHash(b.batchId)}</span></td>
        <td>${b.productName || "—"}</td>
        <td>${b.origin || "—"}</td>
        <td>${fmtDate(b.harvestDate)}</td>
        <td>${b.quantity ? b.quantity + " " + (b.unit || "kg") : "—"}</td>
        <td>${statusBadge(b.isRecalled ? "Recalled" : (b.statusLabel || "Created"))}</td>
        <td>
          <div class="flex gap-6">
            <button class="btn btn-sm btn-ghost"   onclick="viewBatch('${b.displayId || b.batchId}')">View</button>
            <button class="btn btn-sm btn-outline"  onclick="downloadQR('${b.displayId || b.batchId}')">QR</button>
          </div>
        </td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red)">Error: ${err.message}</td></tr>`;
  }
}

/* ── Lab Status ─────────────────────────────────────────── */
async function loadLabStatus() {
  const cont = document.getElementById("lab-status-list");
  if (!cont) return;
  try {
    const { batches = [] } = await API.getAllBatches();
    const active = batches.filter(b => b.status >= 1);
    if (!active.length) {
      cont.innerHTML = `<p class="text-muted text-sm" style="padding:16px 0">No batches in processing yet.</p>`;
      return;
    }
    cont.innerHTML = active.slice(0, 6).map(b => {
      const pct = Math.min(100, Math.round((b.status / 5) * 100));
      return `
        <div style="padding:14px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:10px">
          <div class="flex f-center f-between mb-8">
            <div>
              <div class="fw-600 text-sm">${b.productName}</div>
              <div class="mono">${b.displayId || shortHash(b.batchId)}</div>
            </div>
            ${statusBadge(b.isRecalled ? "Recalled" : (b.statusLabel || "Created"))}
          </div>
          <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>
          <div class="text-xs text-muted mt-8">Updated: ${fmtDate(b.updatedAt || b.createdAt)}</div>
        </div>`;
    }).join("");
  } catch {}
}

/* ── View Batch modal ───────────────────────────────────── */
async function viewBatch(id) {
  try {
    const { batch } = await API.getBatch(id);
    if (!batch) { showToast("Batch not found", "error"); return; }

    document.getElementById("modal-title").textContent = batch.productName || id;
    document.getElementById("modal-body").innerHTML = `
      ${batch.isRecalled ? `<div class="recall-banner"><span style="font-size:20px">⚠️</span><div><div class="fw-700 text-red">RECALLED</div><div class="text-sm" style="color:#fca5a5">${batch.recallReason || ""}</div></div></div>` : ""}
      <div class="grid-2 mb-16">
        ${pair("Batch ID",    batch.displayId || shortHash(batch.batchId))}
        ${pair("Status",      statusBadge(batch.statusLabel || "Created"))}
        ${pair("Product",     batch.productName)}
        ${pair("Origin",      batch.origin)}
        ${pair("Quantity",    batch.quantity + " " + (batch.unit || "kg"))}
        ${pair("Harvest",     fmtDate(batch.harvestDate))}
        ${pair("Expiry",      fmtDate(batch.expiryDate))}
        ${pair("Certificate", batch.certNumber || "—")}
        ${pair("IPFS",        `<span class="mono">${shortHash(batch.metadataHash)}</span>`)}
        ${pair("TX Hash",     `<span class="mono">${shortHash(batch.txHash)}</span>`)}
      </div>
      <div class="divider"></div>
      <div class="fw-700 text-sm mb-12">Supply Chain Events</div>
      <div class="timeline">
        ${(batch.events || []).map(ev => `
          <div class="tl-item">
            <div class="tl-time">${fmtDateTime(ev.timestamp)}</div>
            <div class="tl-title">${ev.stage || ev.action || "—"}</div>
            <div class="tl-desc">${ev.note || ""}</div>
            <div class="tl-hash">${shortHash(ev.txHash)}</div>
          </div>`).join("") || "<p class='text-muted text-sm'>No events yet</p>"}
      </div>
      <div class="qr-wrap mt-16">
        <canvas id="detail-qr"></canvas>
        <div class="qr-id">${batch.displayId || ""}</div>
      </div>`;
    openModal("batch-modal");
    setTimeout(() => {
      const c = document.getElementById("detail-qr");
      if (c) drawQR(c, batch.displayId || batch.batchId, 130);
    }, 50);
  } catch (err) { showToast(err.message, "error"); }
}

function downloadQR(id) {
  const a = document.createElement("a");
  a.href     = API.getQRUrl(id);
  a.download = `${id}-qr.png`;
  a.target   = "_blank";
  a.click();
  showToast("Opening QR code…", "info");
}

/* ── Utils ──────────────────────────────────────────────── */
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function pair(label, value) {
  return `<div><div class="form-label">${label}</div><div class="fw-600 text-sm mt-8">${value || "—"}</div></div>`;
}

function filterBatches(q) {
  document.querySelectorAll("#batch-tbody tr").forEach(r => {
    r.style.display = q ? (r.textContent.toLowerCase().includes(q.toLowerCase()) ? "" : "none") : "";
  });
}
