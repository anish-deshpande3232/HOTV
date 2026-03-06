/**
 * ProvenanceTracker Backend API
 * Handles IPFS uploads, metadata storage, and off-chain operations
 */
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const QRCode = require("qrcode");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────
//  IPFS CLIENT (Infura or local node)
// ─────────────────────────────────────────
let ipfs=null;

// ─────────────────────────────────────────
//  FILE UPLOAD SETUP
// ─────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

// ─────────────────────────────────────────
//  MONGODB SCHEMAS
// ─────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/provenance");

const batchMetaSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  industryType: String,
  producerName: String,
  origin: String,
  productName: String,
  quantity: Number,
  unit: String,
  events: [{
    role: String,
    actor: String,
    action: String,
    metadataHash: String,
    photoHashes: [String],
    notes: String,
    timestamp: Date,
  }],
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

const BatchMeta = mongoose.model("BatchMeta", batchMetaSchema);

// ─────────────────────────────────────────
//  BLOCKCHAIN SETUP (read-only)
// ─────────────────────────────────────────
let contract = null;
// ─────────────────────────────────────────
//  HELPER: Upload to IPFS
// ─────────────────────────────────────────
async function uploadToIPFS(buffer, filename) {
  if (!ipfs) {
    // Simulate IPFS hash for development
    const { createHash } = require("crypto");
    const hash = createHash("sha256").update(buffer).digest("hex");
    return `Qm${hash.substring(0, 44)}`;
  }
  const result = await ipfs.add({ path: filename, content: buffer });
  return result.cid.toString();
}

// ─────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────

/**
 * POST /api/upload/photo
 * Upload a photo to IPFS and return the hash
 */
app.post("/api/upload/photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const hash = await uploadToIPFS(req.file.buffer, req.file.originalname);
    res.json({
      success: true,
      hash,
      ipfsUrl: `https://ipfs.io/ipfs/${hash}`,
      filename: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/upload/metadata
 * Upload JSON metadata to IPFS
 */
app.post("/api/upload/metadata", async (req, res) => {
  try {
    const metadataBuffer = Buffer.from(JSON.stringify(req.body));
    const hash = await uploadToIPFS(metadataBuffer, "metadata.json");
    res.json({ success: true, hash, ipfsUrl: `https://ipfs.io/ipfs/${hash}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/batch/save
 * Save batch off-chain metadata to MongoDB
 */
app.post("/api/batch/save", async (req, res) => {
  try {
    const { batchId, ...data } = req.body;
    const doc = await BatchMeta.findOneAndUpdate(
      { batchId },
      { ...data, batchId, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/batch/:batchId/event
 * Append an event to a batch
 */
app.post("/api/batch/:batchId/event", async (req, res) => {
  try {
    const { batchId } = req.params;
    const event = { ...req.body, timestamp: new Date() };
    const doc = await BatchMeta.findOneAndUpdate(
      { batchId },
      { $push: { events: event }, lastUpdated: new Date() },
      { new: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/batch/:batchId
 * Get full batch provenance (on-chain + off-chain)
 */
app.get("/api/batch/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;

    const offChain = await BatchMeta.findOne({ batchId });

    res.json({
      success: true,
      offChain,
      onChain: null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/batches
 * List all batches from off-chain store
 */
app.get("/api/batches", async (req, res) => {
  try {
    const { role, industry, status } = req.query;
    const filter = {};
    if (industry) filter.industryType = industry;
    if (status) filter["events.action"] = status;
    const batches = await BatchMeta.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/batch/:batchId/qr
 * Generate QR code for batch
 */
app.get("/api/batch/:batchId/qr", async (req, res) => {
  try {
    const { batchId } = req.params;
    const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify/${batchId}`;
    const qrBuffer = await QRCode.toBuffer(url, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    res.set("Content-Type", "image/png");
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/verify/:batchId
 * Public verification endpoint - no auth required
 */
app.get("/api/verify/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;

    const offChain = await BatchMeta.findOne({ batchId });

    res.json({
      success: true,
      batchId,
      verification: {
        exists: !!offChain,
        status: 0,
        currentOwner: null,
        eventCount: offChain?.events?.length || 0
      },
      publicData: offChain ? {
        productName: offChain.productName,
        origin: offChain.origin,
        industryType: offChain.industryType,
        producerName: offChain.producerName,
        createdAt: offChain.createdAt,
        eventsCount: offChain.events?.length || 0,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ProvenanceTracker API running on http://localhost:${PORT}`);
});

module.exports = app;
