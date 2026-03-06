/* =========================================================
   company.js — Company Dashboard Logic
   Calls: GET /api/batch, POST /api/batch/update-status,
          POST /api/batch/recall, GET /api/batch/:id/qr
   ========================================================= */

const BASE_URL = "http://localhost:4000";

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireRole(["company"])) return;
  populateSidebarUser();
  checkBackend();
  await seedIfEmpty();
  showSection("dashboard");
  loadCompanyStats();
  loadIncomingBatches();
  loadAllBatchesTable();
  setupRecallForm();
  setupQRSection();
  Blockchain.updateBadge();
});

/* ── Stats ────────────────────────────────────────────────── */
async function loadCompanyStats() {
  try {
    const { batches = [] } = await API.getAllBatches().catch(() => ({ batches: [] }));
    const total    = batches.length;
    const incoming = batches.filter(b => b.status === 0).length;
    const lab      = batches.filter(b => b.status === 3).length;
    const approved = batches.filter(b => b.status >= 4).length;
    const recalled = batches.filter(b => b.isRecalled).length;
    setText("stat-incoming", incoming);
    setText("stat-lab",      lab);
    setText("stat-approved", approved);
    setText("stat-recalled", recalled);
    // Bar chart
    const safe = (n) => total > 0 ? Math.round((n/total)*100) : 0;
    setBar("bar-approved", safe(approved));
    setBar("bar-lab",      safe(lab));
    setBar("bar-incoming", safe(incoming));
    setText("bar-approved-v", safe(approved)+"%");
    setText("bar-lab-v",      safe(lab)+"%");
    setText("bar-incoming-v", safe(incoming)+"%");
    // Badge count on nav
    const badge = document.getElementById("incoming-badge");
    if (badge) badge.textContent = incoming;
  } catch {}
}

/* ── Incoming Batches ─────────────────────────────────────── */
async function loadIncomingBatches() {
  const cont = document.getElementById("incoming-list");
  if (!cont) return;
  cont.innerHTML = `<div class="flex f-center gap-8" style="padding:20px 0"><span class="loader"></span><span class="text-muted">Loading…</span></div>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    const incoming = batches.filter(b => b.status === 0);
    if (!incoming.length) {
      cont.innerHTML = `<p class="text-muted text-sm" style="padding:20px 0">No incoming batches at this time.</p>`;
      return;
    }
    cont.innerHTML = incoming.map(b => `
      <div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:16px;margin-bottom:10px">
        <div class="flex f-center f-between" style="flex-wrap:wrap;gap:12px">
          <div>
            <div class="fw-700" style="font-size:14px">${b.productName}</div>
            <div class="text-xs text-muted mt-8">🌾 ${b.producerName} · 📍 ${b.origin} · ⚖️ ${b.quantity} ${b.unit||"kg"}</div>
            <div class="mono mt-8">${b.displayId || shortHash(b.batchId)}</div>
          </div>
          <div class="flex gap-8" style="flex-wrap:wrap;align-items:center">
            ${statusBadge(b.statusLabel || "Created")}
            <button class="btn btn-sm btn-primary" onclick="sendToLab('${b.displayId||b.batchId}','${b.batchId}')">🧪 Send to Lab</button>
            <button class="btn btn-sm btn-ghost"   onclick="viewBatchDetail('${b.displayId||b.batchId}')">Details</button>
          </div>
        </div>
      </div>`).join("");
  } catch (err) {
    cont.innerHTML = `<p class="text-red text-sm">Error: ${err.message}</p>`;
  }
}

/* ── Send Batch to Lab ────────────────────────────────────── */
async function sendToLab(displayId, batchId) {
  const btn = event.target;
  btn.innerHTML = '<span class="loader"></span>';
  btn.disabled  = true;
  try {
    const res = await API.updateStatus({
      batchId:    displayId,
      action:     "acceptCustody",
      actorName:  getUserName(),
      actorRole:  "Company",
      notes:      "Batch received and accepted by company — sending to warehouse/lab"
    });
    if (res.success) {
      showToast(`Batch sent to lab! TX: ${shortHash(res.txHash)}`, "success");
      loadIncomingBatches();
      loadCompanyStats();
      loadAllBatchesTable();
    } else {
      showToast("Error: " + (res.error || "Failed"), "error");
    }
  } catch (err) {
    showToast("Backend error: " + err.message, "error");
  } finally {
    btn.innerHTML = "🧪 Send to Lab";
    btn.disabled  = false;
  }
}

/* ── All Batches Table ────────────────────────────────────── */
async function loadAllBatchesTable() {
  const tbody = document.getElementById("company-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--dim)"><span class="loader"></span></td></tr>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    if (!batches.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--dim)">No batches found</td></tr>`;
      return;
    }
    tbody.innerHTML = batches.map(b => `
      <tr>
        <td><span class="mono">${b.displayId || shortHash(b.batchId)}</span></td>
        <td>${b.productName||"—"}</td>
        <td>${b.producerName||"—"}</td>
        <td><span class="badge badge-gray" style="font-size:10px">${b.industryType===1?"Pharma":"Agri"}</span></td>
        <td>${fmtDate(b.createdAt)}</td>
        <td>${statusBadge(b.statusLabel||"Created")}</td>
        <td>
          <div class="flex gap-6">
            <button class="btn btn-sm btn-ghost" onclick="viewBatchDetail('${b.displayId||b.batchId}')">View</button>
            ${b.status>=4&&!b.isRecalled?`<button class="btn btn-sm btn-outline" onclick="showQRFor('${b.displayId||b.batchId}')">QR</button>`:''}
          </div>
        </td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red)">${err.message}</td></tr>`;
  }
}

/* ── QR Section ───────────────────────────────────────────── */
async function setupQRSection() {
  const sel = document.getElementById("qr-batch-select");
  if (!sel) return;
  try {
    const { batches = [] } = await API.getAllBatches();
    sel.innerHTML = `<option value="">— Select batch —</option>` +
      batches.map(b => `<option value="${b.displayId||b.batchId}">${b.displayId||shortHash(b.batchId)} — ${b.productName}</option>`).join("");
  } catch {}
}

function generateQR() {
  const id  = document.getElementById("qr-batch-select")?.value;
  const qrImg = document.getElementById("qr-img");
  const qrRes = document.getElementById("qr-result");
  const qrId  = document.getElementById("qr-display-id");
  if (!id) { showToast("Select a batch first", "warning"); return; }
  if (qrImg)  qrImg.src   = API.getQRUrl(id);
  if (qrId)   qrId.textContent = id;
  if (qrRes)  qrRes.classList.remove("hidden");
  showToast("QR generated for " + id, "success");
}

function showQRFor(id) {
  showSection("qr");
  const sel = document.getElementById("qr-batch-select");
  if (sel) { sel.value = id; generateQR(); }
}

function downloadQRImg() {
  const id  = document.getElementById("qr-display-id")?.textContent;
  const a   = document.createElement("a");
  a.href     = API.getQRUrl(id);
  a.download = `${id}-qr.png`;
  a.target   = "_blank";
  a.click();
}

/* ── Recall Form ──────────────────────────────────────────── */
async function setupRecallForm() {
  const form = document.getElementById("recall-form");
  const sel  = document.getElementById("recall-batch-select");
  if (!form) return;
  try {
    const { batches = [] } = await API.getAllBatches();
    if (sel) {
      const eligible = batches.filter(b => !b.isRecalled);
      sel.innerHTML = `<option value="">— Select batch to recall —</option>` +
        eligible.map(b=>`<option value="${b.displayId||b.batchId}">${b.displayId||shortHash(b.batchId)} — ${b.productName}</option>`).join("");
    }
  } catch {}

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id     = document.getElementById("recall-batch-select")?.value;
    const reason = document.getElementById("recall-reason")?.value.trim();
    if (!id || !reason) { showToast("Select batch and provide reason", "warning"); return; }

    if (!confirm(`⚠️ Permanently recall batch ${id}?\nReason: ${reason}\n\nThis cannot be undone.`)) return;

    const btn = form.querySelector("[type=submit]");
    btn.innerHTML = '<span class="loader"></span> Processing…';
    btn.disabled  = true;

    try {
      const res = await API.recallBatch({ batchId: id, reason, actorName: getUserName() });
      if (res.success) {
        showToast(`⚠️ Batch ${id} recalled. TX: ${shortHash(res.txHash)}`, "error", 7000);
        form.reset();
        loadCompanyStats();
        loadAllBatchesTable();
      } else {
        showToast("Error: " + (res.error||"Failed"), "error");
      }
    } catch (err) {
      showToast("Backend error: " + err.message, "error");
    } finally {
      btn.innerHTML = "⚠️ Issue Recall";
      btn.disabled  = false;
    }
  });
}

/* ── View Batch Detail ────────────────────────────────────── */
async function viewBatchDetail(id) {
  try {
    const { batch } = await API.getBatch(id);
    if (!batch) { showToast("Batch not found", "error"); return; }
    document.getElementById("modal-title").textContent = `${batch.productName} — ${batch.displayId||shortHash(batch.batchId)}`;
    document.getElementById("modal-body").innerHTML = `
      ${batch.isRecalled ? `<div class="recall-banner"><span style="font-size:22px">⚠️</span><div><div class="fw-700 text-red">RECALLED</div><div class="text-sm" style="color:#fca5a5">${batch.recallReason||"No reason provided"}</div></div></div>` : ""}
      <div class="grid-2 mb-16">
        ${pair("Batch ID",    batch.displayId||shortHash(batch.batchId))}
        ${pair("Status",      statusBadge(batch.statusLabel||"Created"))}
        ${pair("Product",     batch.productName)}
        ${pair("Farmer",      batch.producerName)}
        ${pair("Origin",      batch.origin)}
        ${pair("Quantity",    batch.quantity+" "+(batch.unit||"kg"))}
        ${pair("Harvest",     fmtDate(batch.harvestDate))}
        ${pair("Expiry",      fmtDate(batch.expiryDate))}
        ${pair("IPFS Hash",   `<span class="mono">${shortHash(batch.metadataHash)}</span>`)}
        ${pair("TX Hash",     `<span class="mono">${shortHash(batch.txHash)}</span>`)}
      </div>
      <div class="divider"></div>
      <div class="fw-700 text-sm mb-12">Event Timeline</div>
      <div class="timeline">
        ${(batch.events||[]).map(ev=>`
          <div class="tl-item">
            <div class="tl-time">${fmtDateTime(ev.timestamp)}</div>
            <div class="tl-title">${ev.stage||ev.action||"—"}</div>
            <div class="tl-desc">${ev.note||""}</div>
            <div class="tl-hash">${shortHash(ev.txHash)}</div>
          </div>`).join("") || "<p class='text-muted text-sm'>No events</p>"}
      </div>`;
    openModal("batch-modal");
  } catch (err) { showToast(err.message, "error"); }
}

/* ── Utils ───────────────────────────────────────────────── */
function val(id) { const e=document.getElementById(id); return e?e.value.trim():""; }
function setText(id,v){ const e=document.getElementById(id); if(e) e.textContent=v; }
function setBar(id,pct){ const e=document.getElementById(id); if(e) e.style.width=pct+"%"; }
function pair(label,value){ return `<div><div class="form-label">${label}</div><div class="fw-600 text-sm mt-8">${value||"—"}</div></div>`; }
