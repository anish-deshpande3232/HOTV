const { ethers } = require("ethers");
require("dotenv").config();

const contractABI = require("./ProvenanceTracker.json").abi;

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet
);

// ===============================
// 🔒 BLOCKCHAIN INTEGRITY HASH
// This function creates a SHA256 hash of the batch data.
// The hash is stored on the blockchain so that any
// modification in MongoDB can be detected later.
// ===============================

const crypto = require("crypto");

function computeBatchHash(batch) {
const dataString = JSON.stringify({
productName: batch.productName,
producerName: batch.producerName,
origin: batch.origin,
quantity: batch.quantity,
unit: batch.unit,
industryType: batch.industryType
});

return crypto.createHash("sha256").update(dataString).digest("hex");
}

// Basic API

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

// ─────────────────────────
// MongoDB Connection
// ─────────────────────────

mongoose.connect("mongodb://localhost:27017/provenance");

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});

// ─────────────────────────
// Schema
// ─────────────────────────

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

// ─────────────────────────
// Test Route
// ─────────────────────────

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

// Create new batch
app.post("/api/batch", async (req, res) => {
try {

  const {
  industryType,
  photoHash,
  producerName,
  origin,
  productName,
  quantity,
  unit
} = req.body;

const industryEnum = Number(industryType);

console.log("DATA USED FOR HASH:", {
  productName,
  producerName,
  origin,
  quantity,
  unit,
  industryType: industryEnum
});

// ===============================
// 🔒 COMPUTE HASH OF BATCH DATA
// This hash is stored on blockchain
// ===============================

const batchHash = computeBatchHash({
  productName,
  producerName,
  origin,
  quantity,
  unit,
  industryType: industryEnum
});

console.log("HASH STORED ON BLOCKCHAIN:", batchHash);

const tx = await contract.createBatch(
  industryEnum,
  batchHash,
  photoHash
);

const receipt = await tx.wait();

const parsedLogs = receipt.logs
  .map(log => {
    try {
      return contract.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const batchCreatedEvent = parsedLogs.find(
  log => log.name === "BatchCreated"
);

if (!batchCreatedEvent) {
  throw new Error("BatchCreated event not found");
}

const batchId = batchCreatedEvent.args.batchId.toString();

const newBatch = new BatchMeta({
  batchId,
  industryType: industryEnum,
  producerName,
  origin,
  productName,
  quantity,
  unit,
  events: []
});

await newBatch.save();

res.json({
  success: true,
  blockchainBatchId: batchId,
  data: newBatch
});

} 
catch (err) {
console.error(err);
res.status(500).json({ error: err.message });
}
});

// Get multiple batches
app.get("/api/batches", async (req, res) => {
  try {
    const batches = await BatchMeta.find();

    res.json({
      success: true,
      count: batches.length,
      data: batches
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single batch by batchId
app.get("/api/batch/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await BatchMeta.findOne({ batchId });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    res.json({
      success: true,
      data: batch
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Append event to batch
app.post("/api/batch/:batchId/event", async (req, res) => {

  try {
    const { batchId } = req.params;

    const batch = await BatchMeta.findOne({ batchId });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const newEvent = {
      role: req.body.role,
      actor: req.body.actor,
      action: req.body.action,
      metadataHash: req.body.metadataHash || "",
      photoHashes: req.body.photoHashes || [],
      notes: req.body.notes || "",
      timestamp: new Date()
    };

    batch.events.push(newEvent);
    batch.lastUpdated = new Date();

    await batch.save();

    res.json({
      success: true,
      message: "Event added successfully",
      data: batch
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test route
app.get("/api/test", (req, res) => {
  res.send("POST route exists");
});

const PORT = 4000;

// Consumer verification endpoint
app.get("/api/verify/:batchId", async (req, res) => {
try {


const { batchId } = req.params;

const batch = await BatchMeta.findOne({ batchId });

if (!batch) {
  return res.status(404).json({
    verified: false,
    message: "Batch not found in database"
  });
}

// Read blockchain data
const chainBatch = await contract.batches(batchId);

if (!chainBatch.exists) {
  return res.json({
    verified: false,
    message: "Batch not found on blockchain"
  });
}

// ===============================
// 🔒 TAMPER DETECTION
// Recompute the hash from MongoDB data and compare
// it with the hash stored on blockchain.
// ===============================

const recomputedHash = computeBatchHash({
  productName: batch.productName,
  producerName: batch.producerName,
  origin: batch.origin,
  quantity: batch.quantity,
  unit: batch.unit,
  industryType: Number(batch.industryType)
});
const chainHash = chainBatch.metadataHash;

const tampered = recomputedHash !== chainHash;

res.json({
  verified: !tampered,
  tamperingDetected: tampered,
  blockchainHash: chainHash,
  recomputedHash: recomputedHash,
  product: {
    batchId: batch.batchId,
    productName: batch.productName,
    producerName: batch.producerName,
    industryType: batch.industryType,
    quantity: batch.quantity,
    unit: batch.unit
  }
});


} catch (err) {
res.status(500).json({ error: err.message });
}
});


app.get("/api/blockchain/test", async (req, res) => {
  try {
    const ids = await contract.getAllBatchIds();
    res.json(ids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ProvenanceTracker API running on http://localhost:${PORT}`);
});