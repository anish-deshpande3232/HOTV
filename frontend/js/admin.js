/* =========================================================
   admin.js — Admin Dashboard Logic
   Calls: GET /api/analytics, GET /api/users,
          POST /api/users/:id/approve|suspend, GET /api/batch
   ========================================================= */

const BASE_URL = "http://localhost:4000";

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireRole(["admin"])) return;
  populateSidebarUser();
  checkBackend();
  await seedIfEmpty();
  showSection("analytics");
  loadAnalytics();
  loadUsers();
  loadAllBatches();
  Blockchain.updateBadge();
});

/* ── Analytics ──────────────────────────────────────────── */
async function loadAnalytics() {
  const cont = document.getElementById("analytics-content");
  if (cont) cont.style.opacity = "0.5";
  try {
    const { stats } = await API.getAnalytics();
    if (!stats) return;

    setText("a-total",    stats.total);
    setText("a-approved", stats.approved);
    setText("a-recalled", stats.recalled);
    setText("a-pending",  stats.labPending);
    setText("a-delivered",stats.delivered);
    setText("a-users",    stats.totalUsers);
    setText("a-active",   stats.activeUsers);
    setText("a-pending-u",stats.pendingUsers);
    setText("a-rate",     stats.approvalRate + "%");
    setText("a-suspicious", stats.suspiciousScans || 0);

    // Industry bars
    const total = stats.total || 1;
    const agriPct  = Math.round((stats.industries.Agriculture   / total) * 100);
    const pharmPct = Math.round((stats.industries.Pharmaceutical / total) * 100);
    setBar("bar-agri",      agriPct);   setText("bar-agri-v",      agriPct+"%");
    setBar("bar-pharma",    pharmPct);  setText("bar-pharma-v",    pharmPct+"%");
    setBar("bar-rate",      stats.approvalRate); setText("bar-rate-v", stats.approvalRate+"%");
    setBar("bar-suspicious",Math.min(100, Math.round(((stats.suspiciousScans||0)/total)*200)));

    // Region map
    const regEl = document.getElementById("region-list");
    if (regEl && stats.regions) {
      const entries = Object.entries(stats.regions).sort((a,b)=>b[1]-a[1]).slice(0,8);
      const max = entries[0]?.[1] || 1;
      regEl.innerHTML = entries.map(([r,c])=>`
        <div class="bar-row">
          <div class="bar-label">${r.split(",")[0]}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c/max)*100)}%"></div></div>
          <div class="bar-val">${c}</div>
        </div>`).join("") || `<p class="text-muted text-sm">No regional data yet</p>`;
    }

    if (cont) cont.style.opacity = "1";
  } catch (err) {
    showToast("Analytics error: " + err.message, "error");
  }
}

/* ── User Management ────────────────────────────────────── */
async function loadUsers() {
  const cont = document.getElementById("users-list");
  if (!cont) return;
  cont.innerHTML = `<div class="flex f-center gap-8" style="padding:24px"><span class="loader"></span><span class="text-muted">Loading users…</span></div>`;
  try {
    const { users = [] } = await API.getUsers();

    // Filter tabs
    const filter = document.getElementById("user-filter")?.value || "all";
    const filtered = filter === "all" ? users : users.filter(u => u.status === filter);

    const counts = {
      all: users.length,
      pending:   users.filter(u=>u.status==="pending").length,
      active:    users.filter(u=>u.status==="active").length,
      suspended: users.filter(u=>u.status==="suspended").length,
    };
    setText("u-count-all",       counts.all);
    setText("u-count-pending",   counts.pending);
    setText("u-count-active",    counts.active);
    setText("u-count-suspended", counts.suspended);
    // Badge
    const badge = document.getElementById("users-badge");
    if (badge) badge.textContent = counts.pending;

    if (!filtered.length) {
      cont.innerHTML = `<div style="text-align:center;padding:40px;color:var(--dim)">
        <div style="font-size:32px;margin-bottom:10px">👥</div>
        <div class="fw-600">No ${filter === "all" ? "" : filter} users</div>
      </div>`;
      return;
    }

    const roleIcons  = ["🌾","🚚","🏭","🧪","🛡","🚛"];
    const roleNames  = ["Producer","Middleman","Warehouse","Lab","Admin","Transport"];
    const statusCls  = { pending:"badge-amber", active:"badge-green", suspended:"badge-red" };

    cont.innerHTML = filtered.map(u => `
      <div class="user-row" id="user-${u._id}">
        <div class="user-av">${(u.name||"U").charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="user-name">${u.name||"Unknown"}</div>
          <div class="user-email">${u.email||u.address||"No contact"} &nbsp;·&nbsp; ${roleIcons[u.role]||"👤"} ${roleNames[u.role]||"User"} &nbsp;·&nbsp; ${u.industry||"General"}</div>
        </div>
        <span class="badge ${statusCls[u.status]||"badge-gray"}">${u.status||"unknown"}</span>
        <div class="user-actions">
          ${u.status==="pending" ? `<button class="btn btn-sm btn-primary" onclick="approveUser('${u._id}')">✅ Approve</button>` : ""}
          ${u.status==="active"  ? `<button class="btn btn-sm btn-danger"  onclick="suspendUser('${u._id}')">🚫 Suspend</button>` : ""}
          ${u.status==="suspended"?`<button class="btn btn-sm btn-outline"  onclick="approveUser('${u._id}')">♻️ Reactivate</button>` : ""}
        </div>
      </div>`).join("") || `<p class="text-muted text-sm" style="padding:16px">No users found</p>`;
  } catch (err) {
    cont.innerHTML = `<p class="text-red text-sm" style="padding:16px">Error: ${err.message}</p>`;
  }
}

async function approveUser(id) {
  try {
    const res = await API.approveUser(id);
    if (res.success) { showToast("User approved ✅", "success"); loadUsers(); loadAnalytics(); }
    else showToast("Error: " + (res.error||"Failed"), "error");
  } catch (err) { showToast(err.message, "error"); }
}

async function suspendUser(id) {
  if (!confirm("Suspend this user? They will lose dashboard access.")) return;
  try {
    const res = await API.suspendUser(id);
    if (res.success) { showToast("User suspended", "warning"); loadUsers(); loadAnalytics(); }
    else showToast("Error: " + (res.error||"Failed"), "error");
  } catch (err) { showToast(err.message, "error"); }
}

/* ── All Batches Table ──────────────────────────────────── */
async function loadAllBatches() {
  const tbody = document.getElementById("admin-batch-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--dim)"><span class="loader"></span></td></tr>`;
  try {
    const { batches = [] } = await API.getAllBatches();
    if (!batches.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--dim)">No batches found. <a href="#" onclick="seedDemo()" style="color:var(--green)">Load demo data</a></td></tr>`;
      return;
    }
    tbody.innerHTML = batches.map(b => `
      <tr>
        <td><span class="mono">${b.displayId||shortHash(b.batchId)}</span></td>
        <td>${b.productName||"—"}</td>
        <td>${b.producerName||"—"}</td>
        <td>${b.origin||"—"}</td>
        <td><span class="badge badge-gray" style="font-size:9px">${b.industryType===1?"Pharma":"Agri"}</span></td>
        <td>${fmtDate(b.createdAt)}</td>
        <td>${statusBadge(b.isRecalled?"Recalled":(b.statusLabel||"Created"))}</td>
        <td>
          <div class="flex gap-6">
            <button class="btn btn-sm btn-ghost" onclick="viewAdminBatch('${b.displayId||b.batchId}')">View</button>
            ${b.status===3?`<button class="btn btn-sm btn-primary" onclick="adminApprove('${b.displayId||b.batchId}')">✅ Approve</button>`:""}
          </div>
        </td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red)">${err.message}</td></tr>`;
  }
}

/* ── Admin Approve Batch ──────────────────────────────────  */
async function adminApprove(id) {
  if (!confirm(`Approve batch ${id}? This will be recorded on-chain.`)) return;
  try {
    const res = await API.updateStatus({
      batchId:   id,
      action:    "adminApprove",
      actorName: getUserName(),
      actorRole: "Admin",
      notes:     "Batch approved by platform admin"
    });
    if (res.success) {
      showToast(`Batch ${id} approved! TX: ${shortHash(res.txHash)}`, "success");
      loadAllBatches();
      loadAnalytics();
    } else showToast("Error: " + (res.error||"Failed"), "error");
  } catch (err) { showToast(err.message, "error"); }
}

/* ── View Batch ─────────────────────────────────────────── */
async function viewAdminBatch(id) {
  try {
    const { batch, onChain } = await API.getBatch(id);
    if (!batch) { showToast("Batch not found", "error"); return; }
    document.getElementById("modal-title").textContent = `Admin View — ${batch.displayId||id}`;
    document.getElementById("modal-body").innerHTML = `
      ${batch.isRecalled?`<div class="recall-banner"><span style="font-size:20px">⚠️</span><div><div class="fw-700 text-red">RECALLED</div><div class="text-sm" style="color:#fca5a5">${batch.recallReason}</div></div></div>`:""}
      <div class="grid-2 mb-16">
        ${pair("Batch ID",    batch.displayId||shortHash(batch.batchId))}
        ${pair("Status",      statusBadge(batch.statusLabel||"—"))}
        ${pair("Product",     batch.productName)}
        ${pair("Producer",    batch.producerName)}
        ${pair("Origin",      batch.origin)}
        ${pair("Industry",    batch.industryType===1?"Pharmaceutical":"Agriculture")}
        ${pair("Qty",         batch.quantity+" "+(batch.unit||"kg"))}
        ${pair("Cert #",      batch.certNumber||"—")}
        ${pair("TX Hash",     `<span class="mono">${shortHash(batch.txHash)}</span>`)}
        ${pair("IPFS",        `<span class="mono">${shortHash(batch.metadataHash)}</span>`)}
      </div>
      ${onChain?.exists?`
        <div class="alert alert-success mb-16">
          <span class="alert-icon">⛓</span>
          <span class="alert-text">On-chain status: <strong>${onChain.status}</strong> &nbsp;·&nbsp; Events: ${onChain.eventCount} &nbsp;·&nbsp; Owner: <span class="mono">${shortHash(onChain.owner)}</span></span>
        </div>`:""}
      <div class="divider"></div>
      <div class="fw-700 text-sm mb-12">Event Timeline (${(batch.events||[]).length} events)</div>
      <div class="timeline">
        ${(batch.events||[]).map(ev=>`
          <div class="tl-item">
            <div class="tl-time">${fmtDateTime(ev.timestamp)}</div>
            <div class="tl-title">${ev.stage||ev.action||"—"} <span class="badge badge-gray" style="font-size:9px;margin-left:4px">${ev.role||""}</span></div>
            <div class="tl-desc">${ev.note||""}</div>
            <div class="tl-hash">${shortHash(ev.txHash)}</div>
          </div>`).join("")||"<p class='text-muted text-sm'>No events</p>"}
      </div>
      ${batch.status===3?`
        <div class="divider"></div>
        <button class="btn btn-primary btn-full mt-12" onclick="adminApprove('${batch.displayId||batch.batchId}');closeModal('batch-modal')">
          ✅ Approve This Batch
        </button>`:""}`;
    openModal("batch-modal");
  } catch (err) { showToast(err.message, "error"); }
}

/* ── Seed demo data ─────────────────────────────────────── */
async function seedDemo() {
  try {
    const res = await API.seed();
    showToast(res.message || "Seeded!", "success");
    loadAllBatches();
    loadAnalytics();
  } catch (err) { showToast(err.message, "error"); }
}

/* ── Utils ───────────────────────────────────────────────── */
function val(id) { const e=document.getElementById(id); return e?e.value.trim():""; }
function setText(id,v){ const e=document.getElementById(id); if(e) e.textContent=v; }
function setBar(id,pct){ const e=document.getElementById(id); if(e) e.style.width=pct+"%"; }
function pair(l,v){ return `<div><div class="form-label">${l}</div><div class="fw-600 text-sm mt-8">${v||"—"}</div></div>`; }
