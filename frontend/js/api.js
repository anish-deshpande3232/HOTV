/* =========================================================
   api.js — API client for ProvenanceTracker Backend
   Base URL: http://localhost:4000
   ========================================================= */

const BASE_URL = "http://localhost:4000";

async function apiPost(url, data) {
  const res = await fetch(BASE_URL + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiGet(url) {
  const res = await fetch(BASE_URL + url);
  return res.json();
}

async function apiUpload(url, formData) {
  const res = await fetch(BASE_URL + url, { method: "POST", body: formData });
  return res.json();
}

/* ── Named helpers ──────────────────────────────────────── */
const API = {
  health:         ()           => apiGet("/api/health"),
  seed:           ()           => apiPost("/api/seed", {}),
  createBatch:    (data)       => apiPost("/api/batch/save", data),
  getAllBatches:   ()           => apiGet("/api/batch"),
  getBatch:       (id)         => apiGet(`/api/batch/${id}`),
  verifyBatch:    (id)         => apiGet(`/api/verify/${id}`),
  getBatchHistory:(id)         => apiGet(`/api/batch/${id}/history`),
  updateStatus:   (data)       => apiPost("/api/batch/update-status", data),
  recallBatch:    (data)       => apiPost("/api/batch/recall", data),
  getQRUrl:       (id)         => `${BASE_URL}/api/batch/${id}/qr`,
  getAnalytics:   ()           => apiGet("/api/analytics"),
  getUsers:       ()           => apiGet("/api/users"),
  approveUser:    (id)         => apiPost(`/api/users/${id}/approve`, {}),
  suspendUser:    (id)         => apiPost(`/api/users/${id}/suspend`, {}),
  uploadPhoto:    (file)       => {
    const fd = new FormData();
    fd.append("photo", file);
    return apiUpload("/api/upload/photo", fd);
  },
  uploadMetadata: (obj)        => apiPost("/api/upload/metadata", obj),
};
