/* =========================================================
   lab.js — Lab Dashboard Logic
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireRole(["lab"])) return;
  populateSidebarUser();
  checkBackend();
  await seedIfEmpty();
  showSection("dashboard");
  loadLabStats();
  loadPendingBatches();
  loadCompletedTests();
  setupReportForm();
  loadNextPreview();
  Blockchain.updateBadge();

  // Lab report file upload — works offline, shows preview
  setupUploadZone("lab-file-zone", (res) => {
    window._labFileUpload = res;
    showToast(
      res.source === "IPFS"
        ? `Report pinned to IPFS: ${shortHash(res.hash)}`
        : `Report file ready (${res.file.name})`,
      "success"
    );
  }, {
    icon:   "📄",
    label:  "Click or drag lab report here",
    sub:    "PDF, images, or documents up to 20MB",
    accept: "image/*,.pdf,.doc,.docx"
  });
});

/* ── Stats ──────────────────────────────────────────────── */
async function loadLabStats() {
  try {
    const { batches = [] } = await API.getAllBatches().catch(() => ({ batches: [] }));
    const pending  = batches.filter(b => b.status >= 1 && b.status <= 2).length;
    const verified = batches.filter(b => b.status === 3).length;
    const approved = batches.filter(b => b.status >= 4).length;
    setText("stat-pending",  pending);
    setText("stat-verified", verified);
    setText("stat-approved", approved);
    setText("stat-total",    batches.length);
    const badge = document.getElementById("pending-badge");
    if (badge) badge.textContent = pending;
  } catch {}
}

/* ── Pending Batches ────────────────────────────────────── */
async function loadPendingBatches() {
  const cont = document.getElementById("pending-list");
  if (!cont) return;
  cont.innerHTML = `<div class="flex f-center gap-8" style="padding:24px 0"><span class="loader"></span><span class="text-muted">Loading pending tests…</span></div>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    const pending = batches.filter(b => b.status >= 1 && b.status <= 2);
    if (!pending.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--dim)">
          <div style="font-size:40px;margin-bottom:12px">🎉</div>
          <div class="fw-600">No pending tests</div>
          <div class="text-xs text-muted mt-8">All batches processed!</div>
        </div>`;
      return;
    }
    cont.innerHTML = pending.map(b => `
      <div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r);padding:18px;margin-bottom:12px;transition:border-color .2s"
           onmouseover="this.style.borderColor='rgba(168,85,247,.35)'" onmouseout="this.style.borderColor='var(--border)'">
        <div class="flex f-center f-between" style="flex-wrap:wrap;gap:12px;margin-bottom:12px">
          <div>
            <div class="fw-700" style="font-size:15px">${b.productName}</div>
            <div class="text-xs text-muted mt-8">
              🌾 ${b.producerName} &nbsp;·&nbsp; 📍 ${b.origin}
              &nbsp;·&nbsp; <span class="badge badge-gray" style="font-size:9px">${b.industryType === 1 ? "Pharma" : "Agriculture"}</span>
            </div>
          </div>
          <div class="flex gap-8 f-center">
            ${statusBadge(b.statusLabel || "Pending")}
            <span class="mono" style="font-size:10px;color:var(--dim)">${b.displayId || shortHash(b.batchId)}</span>
          </div>
        </div>
        <div class="grid-2 mb-12" style="gap:10px">
          <div style="background:rgba(255,255,255,.02);border-radius:var(--r-sm);padding:10px">
            <div class="form-label">Quantity</div>
            <div class="fw-600 text-sm mt-8">${b.quantity} ${b.unit || "kg"}</div>
          </div>
          <div style="background:rgba(255,255,255,.02);border-radius:var(--r-sm);padding:10px">
            <div class="form-label">Harvest Date</div>
            <div class="fw-600 text-sm mt-8">${fmtDate(b.harvestDate)}</div>
          </div>
        </div>
        ${b.certNumber ? `<div class="text-xs mb-12" style="color:var(--dim)">Cert: <span class="mono">${b.certNumber}</span></div>` : ""}
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="openTestForm('${b.displayId || b.batchId}','${b.productName.replace(/'/g,"\\'")}',${b.industryType || 0})">
            📋 Upload Test Report
          </button>
          <button class="btn btn-sm btn-outline" onclick="viewLabBatch('${b.displayId || b.batchId}')">View Details</button>
        </div>
      </div>`).join("");
  } catch (err) {
    cont.innerHTML = `<p class="text-red text-sm">Error: ${err.message}</p>`;
  }
}

/* ── Open upload form for a batch ───────────────────────── */
function openTestForm(batchId, name, industryType) {
  showSection("upload");
  const el = document.getElementById("lab-batch-id");
  const nm = document.getElementById("lab-batch-name");
  if (el) el.value       = batchId;
  if (nm) nm.textContent = name + " — " + batchId;
  // Reset the upload zone
  clearUpload("lab-file-zone");
  setupUploadZone("lab-file-zone", (res) => {
    window._labFileUpload = res;
    showToast(res.source === "IPFS" ? `Pinned to IPFS: ${shortHash(res.hash)}` : `File ready: ${res.file.name}`, "success");
  }, { icon:"📄", label:"Click or drag lab report here", sub:"PDF, images up to 20MB", accept:"image/*,.pdf,.doc,.docx" });

  // Toggle agri / pharma fields
  const isPharma = parseInt(industryType) === 1;
  document.querySelectorAll(".lab-agri-field").forEach(e  => e.classList.toggle("hidden", isPharma));
  document.querySelectorAll(".lab-pharma-field").forEach(e => e.classList.toggle("hidden", !isPharma));
}

/* ── Report Upload Form ─────────────────────────────────── */
function setupReportForm() {
  const form = document.getElementById("report-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const batchId = document.getElementById("lab-batch-id")?.value?.trim();
    if (!batchId) { showToast("No batch selected — click 'Upload Test Report' from the Pending list", "warning"); return; }

    const result = document.getElementById("test-result")?.value;
    if (!result) { showToast("Select Approved or Rejected", "warning"); return; }

    const btn = form.querySelector("[type=submit]");
    btn.innerHTML = '<span class="loader"></span> Submitting…';
    btn.disabled  = true;

    // Gather uploaded file hash
    const labFileUpload = getUpload("lab-file-zone");
    const fileHash = labFileUpload?.hash || "";
    const fileName = labFileUpload?.file?.name || "";

    // Build report object
    const report = {
      result,
      labName:      getUserName(),
      testDate:     new Date().toISOString(),
      notes:        val("lab-notes"),
      moisture:     val("moisture"),
      pesticide:    val("pesticide"),
      heavy_metals: val("heavy-metals"),
      potency:      val("potency"),
      dissolution:  val("dissolution"),
      sterility:    val("sterility"),
      fileHash,
      fileName
    };

    // Digital signature
    const { sig, simulated } = await Blockchain.signMessage(report);
    report.signature = sig;
    report.sigType   = simulated ? "simulated" : "metamask";

    // Show signature
    const sigEl = document.getElementById("sig-display");
    const sigV  = document.getElementById("sig-value");
    if (sigEl && sig) { sigEl.classList.remove("hidden"); if (sigV) sigV.textContent = sig.slice(0, 80) + "…"; }

    try {
      // Upload report JSON to IPFS (or get local hash)
      const ipfsRes = await API.uploadMetadata(report).catch(() => ({ hash: null }));
      report.reportHash = ipfsRes?.hash || await (async () => {
        // local fallback
        let h = 0;
        const s = JSON.stringify(report);
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return "Qm" + Math.abs(h).toString(16).padStart(8,"0").repeat(6).slice(0,44);
      })();

      const res = await API.updateStatus({
        batchId,
        action:       "uploadLabResult",
        actorName:    getUserName(),
        actorRole:    "Lab",
        notes:        `Lab result: ${result}. ${val("lab-notes")}`,
        result:       report,
        metadataHash: report.reportHash
      });

      if (res.success) {
        showToast(
          `Report submitted! Result: ${result} · TX: ${shortHash(res.txHash)}`,
          result === "Approved" ? "success" : "warning",
          7000
        );
        form.reset();
        window._labFileUpload = null;
        clearUpload("lab-file-zone");
        setupUploadZone("lab-file-zone", null, { icon:"📄", label:"Click or drag lab report here", sub:"PDF, images up to 20MB", accept:"image/*,.pdf,.doc,.docx" });
        sigEl?.classList.add("hidden");
        const nm = document.getElementById("lab-batch-name");
        if (nm) nm.textContent = "Select a batch from Pending Tests";
        loadLabStats();
        loadPendingBatches();
        loadCompletedTests();
        showSection("pending");
      } else {
        showToast("Error: " + (res.error || "Failed"), "error");
      }
    } catch (err) {
      showToast("Backend error: " + err.message, "error");
    } finally {
      btn.innerHTML = "🔬 Submit Report";
      btn.disabled  = false;
    }
  });
}

/* ── Completed Tests ────────────────────────────────────── */
async function loadCompletedTests() {
  const tbody = document.getElementById("completed-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--dim)"><span class="loader"></span></td></tr>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    const done = batches.filter(b => b.status >= 3);
    if (!done.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--dim)">No completed tests yet</td></tr>`;
      return;
    }
    tbody.innerHTML = done.map(b => {
      const result = b.labResult?.result || "—";
      const resCls = result === "Approved" ? "badge-green" : result === "Rejected" ? "badge-red" : "badge-gray";
      return `<tr>
        <td><span class="mono">${b.displayId || shortHash(b.batchId)}</span></td>
        <td>${b.productName || "—"}</td>
        <td><span class="badge badge-gray" style="font-size:9px">${b.industryType === 1 ? "Pharma" : "Agri"}</span></td>
        <td>${fmtDate(b.updatedAt || b.createdAt)}</td>
        <td><span class="badge ${resCls}">${result}</span></td>
        <td>${statusBadge(b.statusLabel || "LabVerified")}</td>
        <td><button class="btn btn-sm btn-ghost" onclick="viewLabBatch('${b.displayId || b.batchId}')">Details</button></td>
      </tr>`;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red)">${err.message}</td></tr>`;
  }
}

/* ── Next test preview on dashboard ─────────────────────── */
async function loadNextPreview() {
  const el = document.getElementById("next-test-preview");
  if (!el) return;
  try {
    const { batches = [] } = await API.getAllBatches();
    const next = batches.find(b => b.status >= 1 && b.status <= 2);
    if (next) {
      el.innerHTML = `
        <div class="fw-700 text-sm mb-8">${next.productName}</div>
        <div class="text-xs text-muted mb-12">${next.producerName} · ${next.origin}</div>
        ${statusBadge(next.statusLabel || "In Transit")}
        <button class="btn btn-primary btn-full mt-16"
          onclick="openTestForm('${next.displayId || next.batchId}','${next.productName.replace(/'/g,"\\'")}',${next.industryType || 0});showSection('upload')">
          Start Testing →
        </button>`;
    } else {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--dim)">🎉 No pending tests</div>`;
    }
  } catch {}
}

/* ── View batch modal ───────────────────────────────────── */
async function viewLabBatch(id) {
  try {
    const { batch } = await API.getBatch(id);
    if (!batch) { showToast("Batch not found", "error"); return; }
    const lr = batch.labResult || {};
    document.getElementById("modal-title").textContent = `${batch.productName} — Lab Details`;
    document.getElementById("modal-body").innerHTML = `
      <div class="grid-2 mb-16">
        ${pair("Batch ID",  batch.displayId || shortHash(batch.batchId))}
        ${pair("Status",    statusBadge(batch.statusLabel || "—"))}
        ${pair("Product",   batch.productName)}
        ${pair("Origin",    batch.origin)}
        ${pair("Industry",  batch.industryType === 1 ? "Pharmaceutical" : "Agriculture")}
        ${pair("Cert #",    batch.certNumber || "—")}
      </div>
      ${lr.result ? `
        <div class="divider"></div>
        <div class="fw-700 text-sm mb-12">Lab Report</div>
        <div class="grid-2 mb-16">
          ${pair("Result",    `<span class="badge ${lr.result === "Approved" ? "badge-green" : "badge-red"}">${lr.result}</span>`)}
          ${pair("Lab",       lr.labName || "—")}
          ${lr.moisture  ? pair("Moisture",  lr.moisture)  : ""}
          ${lr.pesticide ? pair("Pesticide", lr.pesticide) : ""}
          ${lr.potency   ? pair("Potency",   lr.potency)   : ""}
          ${lr.fileName  ? pair("Report File", `<span class="mono">${lr.fileName}</span>`) : ""}
          ${pair("Notes",     lr.notes || "—")}
        </div>
        ${lr.signature ? `
          <div class="fw-700 text-sm mb-8">Digital Signature <span class="badge badge-purple" style="margin-left:6px">${lr.sigType || "signed"}</span></div>
          <div class="sig-box">${lr.signature}</div>` : ""}
      ` : `<div class="alert alert-info"><span class="alert-icon">ℹ️</span><span class="alert-text">Lab report not yet submitted</span></div>`}
      <div class="divider"></div>
      <div class="fw-700 text-sm mb-12">Event Timeline</div>
      <div class="timeline">
        ${(batch.events || []).map(ev => `
          <div class="tl-item">
            <div class="tl-time">${fmtDateTime(ev.timestamp)}</div>
            <div class="tl-title">${ev.stage || ev.action || "—"}</div>
            <div class="tl-desc">${ev.note || ""}</div>
            <div class="tl-hash">${shortHash(ev.txHash)}</div>
          </div>`).join("") || "<p class='text-muted text-sm'>No events</p>"}
      </div>`;
    openModal("batch-modal");
  } catch (err) { showToast(err.message, "error"); }
}

/* ── Utils ──────────────────────────────────────────────── */
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function pair(l, v) { return `<div><div class="form-label">${l}</div><div class="fw-600 text-sm mt-8">${v || "—"}</div></div>`; }

function filterTable(q, tbodyId) {
  document.querySelectorAll("#" + tbodyId + " tr").forEach(r => {
    r.style.display = q ? (r.textContent.toLowerCase().includes(q.toLowerCase()) ? "" : "none") : "";
  });
}
