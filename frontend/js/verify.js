/* =========================================================
   verify.js — Consumer Public Verification Page
   Calls: GET /api/verify/:id, GET /api/batch/:id/history
   ========================================================= */

const BASE_URL = "http://localhost:4000";

document.addEventListener("DOMContentLoaded", () => {
  checkBackend();
  // Auto-verify if ?batch= param present
  const params = new URLSearchParams(window.location.search);
  const batchParam = params.get("batch");
  if (batchParam) {
    const inp = document.getElementById("verify-input");
    if (inp) inp.value = batchParam;
    verifyBatch();
  }
  // Demo chips
  document.querySelectorAll(".demo-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const inp = document.getElementById("verify-input");
      if (inp) { inp.value = chip.dataset.id; verifyBatch(); }
    });
  });
});

async function verifyBatch() {
  const id = document.getElementById("verify-input")?.value?.trim();
  if (!id) { showToast("Enter a Batch ID or scan QR", "warning"); return; }

  const btn = document.getElementById("verify-btn");
  const res = document.getElementById("verify-result");
  if (btn) { btn.innerHTML = '<span class="loader"></span> Verifying…'; btn.disabled = true; }
  if (res) res.innerHTML = "";

  try {
    const data = await API.verifyBatch(id);

    if (!data.exists || !data.batch) {
      if (res) res.innerHTML = `
        <div class="verify-card fade-up">
          <div class="verify-card-head">
            <div>
              <div style="font-size:32px;margin-bottom:8px">❌</div>
              <div class="fw-700" style="font-size:18px">Batch Not Found</div>
              <div class="text-muted text-sm mt-8">No records found for <span class="mono">${id}</span></div>
            </div>
          </div>
          <div style="padding:22px">
            <div class="alert alert-danger">
              <span class="alert-icon">⚠️</span>
              <span class="alert-text">This product could not be verified. It may be counterfeit or the ID may be incorrect.</span>
            </div>
          </div>
        </div>`;
      return;
    }

    const b = data.batch;
    renderVerifyResult(b, data.onChain);
  } catch (err) {
    if (res) res.innerHTML = `<div class="alert alert-danger"><span class="alert-icon">⚠️</span><span class="alert-text">Verification error: ${err.message}. Is the backend running?</span></div>`;
  } finally {
    if (btn) { btn.innerHTML = "🔍 Verify"; btn.disabled = false; }
  }
}

function renderVerifyResult(b, onChain) {
  const res = document.getElementById("verify-result");
  if (!res) return;

  const isVerified = !b.isRecalled && b.status >= 3;
  const statusColor = b.isRecalled ? "var(--red)" : b.status >= 4 ? "var(--green)" : "var(--amber)";
  const statusIcon  = b.isRecalled ? "⚠️" : b.status >= 4 ? "✅" : b.status >= 3 ? "🧪" : "⏳";
  const verifiedBadge = b.isRecalled
    ? `<span class="badge badge-red" style="font-size:13px;padding:6px 14px">⚠️ RECALLED</span>`
    : b.status >= 4
      ? `<span class="badge badge-green" style="font-size:13px;padding:6px 14px">✅ VERIFIED</span>`
      : `<span class="badge badge-amber" style="font-size:13px;padding:6px 14px">⏳ In Process</span>`;

  // Build supply chain progress
  const stages  = ["Created","In Transit","In Warehouse","Lab Verified","Approved","Delivered"];
  const pct     = Math.min(100, Math.round(((b.status||0) / 5) * 100));

  const stageHtml = stages.map((s, i) => {
    const done    = i <= (b.status||0);
    const current = i === (b.status||0);
    const col     = done ? "var(--green)" : "var(--border)";
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0">
      <div style="width:28px;height:28px;border-radius:50%;background:${done?"rgba(0,230,118,.15)":"rgba(255,255,255,.04)"};border:2px solid ${col};display:flex;align-items:center;justify-content:center;font-size:12px;${current?"box-shadow:0 0 12px rgba(0,230,118,.4)":""}">${done?"✓":""}</div>
      <div style="font-size:9px;color:${done?"var(--text)":"var(--dim)"};text-align:center;line-height:1.3;font-weight:${done?"600":"400"}">${s}</div>
    </div>`;
  }).join(`<div style="height:2px;flex:1;background:linear-gradient(90deg,var(--green),var(--border));margin-top:13px;align-self:flex-start"></div>`);

  // Events timeline (last 5)
  const events = (b.events || []).slice(-5).reverse();
  const timelineHtml = events.length ? events.map(ev => `
    <div class="tl-item">
      <div class="tl-time">${fmtDateTime(ev.timestamp)}</div>
      <div class="tl-title">${ev.stage || ev.action || "—"} <span class="badge badge-gray" style="font-size:9px;margin-left:4px">${ev.role||""}</span></div>
      <div class="tl-desc">${ev.note||""}</div>
      <div class="tl-hash">${shortHash(ev.txHash)}</div>
    </div>`).join("")
    : `<p class="text-muted text-sm">No events recorded</p>`;

  // Lab result
  const lr = b.labResult || {};
  const labHtml = lr.result ? `
    <div class="flex f-between f-center mb-12" style="flex-wrap:wrap;gap:8px">
      <div class="fw-700 text-sm">Lab Results</div>
      <span class="badge ${lr.result==="Approved"?"badge-green":"badge-red"}">${lr.result}</span>
    </div>
    <div class="grid-2" style="gap:10px">
      ${lr.moisture  ? `<div class="info-row"><span class="info-label">Moisture</span><span class="info-val">${lr.moisture}</span></div>` : ""}
      ${lr.pesticide ? `<div class="info-row"><span class="info-label">Pesticide</span><span class="info-val">${lr.pesticide}</span></div>` : ""}
      ${lr.potency   ? `<div class="info-row"><span class="info-label">Potency</span><span class="info-val">${lr.potency}</span></div>` : ""}
      ${lr.notes     ? `<div style="grid-column:1/-1"><div class="info-label">Notes</div><div class="fw-600 text-sm mt-8">${lr.notes}</div></div>` : ""}
    </div>` : `<p class="text-muted text-sm">Lab testing pending</p>`;

  res.innerHTML = `
    <div class="verify-card fade-up">
      ${b.isRecalled ? `
        <div class="recall-banner" style="border-radius:0;margin:0">
          <span style="font-size:26px">⚠️</span>
          <div>
            <div class="fw-700 text-red" style="font-size:16px">PRODUCT RECALL NOTICE</div>
            <div style="color:#fca5a5;font-size:13px;margin-top:3px">${b.recallReason || "This batch has been recalled. Do not consume."}</div>
          </div>
        </div>` : ""}

      <div class="verify-card-head">
        <div>
          <div class="text-xs text-muted mb-8">PRODUCT VERIFICATION</div>
          <div class="fw-700" style="font-size:22px">${b.productName}</div>
          <div class="text-muted text-sm mt-8">📍 ${b.origin} &nbsp;·&nbsp; 🌾 ${b.producerName}</div>
          <div class="mono mt-12" style="font-size:10px;color:var(--dim)">${b.displayId || shortHash(b.batchId)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
          ${verifiedBadge}
          <div id="verify-qr-wrap"></div>
        </div>
      </div>

      <!-- Supply chain progress -->
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.15)">
        <div class="form-label mb-12">Supply Chain Progress (${pct}%)</div>
        <div style="display:flex;align-items:flex-start;gap:0">${stageHtml}</div>
      </div>

      <div class="verify-pgrid">
        <!-- Product Info -->
        <div class="verify-sec">
          <div class="verify-sec-title">Product Info</div>
          <div class="info-row"><span class="info-label">Industry</span><span class="info-val">${b.industryType===1?"Pharmaceutical":"Agriculture"}</span></div>
          <div class="info-row"><span class="info-label">Quantity</span><span class="info-val">${b.quantity} ${b.unit||"kg"}</span></div>
          <div class="info-row"><span class="info-label">Harvest Date</span><span class="info-val">${fmtDate(b.harvestDate)}</span></div>
          <div class="info-row"><span class="info-label">Expiry Date</span><span class="info-val">${fmtDate(b.expiryDate)}</span></div>
          <div class="info-row"><span class="info-label">Certificate</span><span class="info-val mono">${b.certNumber||"—"}</span></div>
          ${b.notes ? `<div class="info-row"><span class="info-label">Notes</span><span class="info-val" style="max-width:180px;text-align:right">${b.notes}</span></div>`:""}
        </div>

        <!-- Lab Results -->
        <div class="verify-sec">${labHtml}</div>

        <!-- Blockchain Proof -->
        <div class="verify-sec">
          <div class="verify-sec-title">Blockchain Proof</div>
          <div class="info-row"><span class="info-label">TX Hash</span><span class="info-val mono">${shortHash(b.txHash)}</span></div>
          <div class="info-row"><span class="info-label">IPFS Metadata</span><span class="info-val mono">${shortHash(b.metadataHash)}</span></div>
          <div class="info-row"><span class="info-label">Network Status</span><span class="info-val">${onChain?.exists ? `<span class="status-dot s-active">On-chain</span>` : `<span class="status-dot s-transit">DB only</span>`}</span></div>
          ${onChain?.exists?`<div class="info-row"><span class="info-label">On-chain Status</span><span class="info-val">${onChain.status||"—"}</span></div>`:""}
          ${b.txHash?`<div style="margin-top:10px"><a href="https://explorer.example.com/tx/${b.txHash}" target="_blank" class="btn btn-sm btn-ghost" style="font-size:11px">View on Explorer ↗</a></div>`:""}
        </div>

        <!-- Origin Map -->
        <div class="verify-sec">
          <div class="verify-sec-title">Origin Location</div>
          <div class="map-placeholder">
            <span style="font-size:28px">🗺️</span>
            <div class="fw-600" style="font-size:13px">${b.origin}</div>
            <div class="text-xs text-muted">Interactive map coming soon</div>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div style="padding:22px 28px;border-top:1px solid var(--border)">
        <div class="verify-sec-title" style="margin-bottom:16px">Full Journey Timeline</div>
        <div class="timeline">${timelineHtml}</div>
      </div>

      <!-- Actions -->
      <div style="padding:16px 28px 22px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Certificate</button>
        <button class="btn btn-outline" onclick="shareResult('${b.displayId||b.batchId}')">📤 Share</button>
        <a href="${API.getQRUrl(b.displayId||b.batchId)}" target="_blank" class="btn btn-ghost">⬇️ Download QR</a>
      </div>
    </div>`;

  // Draw QR inside the result
  setTimeout(() => {
    const qwrap = document.getElementById("verify-qr-wrap");
    if (qwrap) {
      const c = document.createElement("canvas");
      qwrap.appendChild(c);
      drawQR(c, b.displayId || b.batchId, 90);
    }
  }, 80);
}

function shareResult(id) {
  const url = `${window.location.origin}${window.location.pathname}?batch=${id}`;
  if (navigator.share) {
    navigator.share({ title: "ProvenanceChain Verification", url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard!", "success"));
  }
}
