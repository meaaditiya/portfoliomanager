const express = require("express");
const multer = require("multer")();
const authenticateToken = require("../middlewares/authMiddleware");
const bucket = require("../services/gcs");
const Document = require("../models/Document");

// FIX: use generateQueryEmbedding, remove generateEmbedding
const { generateQueryEmbedding, cosineSimilarity } = require("../services/embeddingService");

const router = express.Router();


// ===============================
// 1. ADMIN UPLOAD DOCUMENT
// ===============================
router.post("/api/admin/document/upload", authenticateToken, multer.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const storedName = Date.now() + "-" + file.originalname;
    const gcsFile = bucket.file(storedName);

    // upload to GCS
    await gcsFile.save(file.buffer, { resumable: false });

    // FIX: embedding from filename using generateQueryEmbedding
    const embedding = await generateQueryEmbedding(file.originalname);

    // save metadata
    const doc = await Document.create({
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
      gcsPath: storedName,
      embedding
    });

    res.json({ message: "Uploaded", id: doc._id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// 2. GET FILE METADATA
// ===============================
router.get("/api/file/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    res.json(doc);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// 3. SECURE DOWNLOAD (Signed URL)
// ===============================
router.get("/api/download/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const file = bucket.file(doc.gcsPath);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 30 * 60 * 1000  // 30 mins
    });

    res.json({ downloadUrl: url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// 4. SEARCH DOCUMENTS (Embedding)
// ===============================
router.get("/api/document/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ message: "Query missing" });

    // create embedding from query
    const queryEmbedding = await generateQueryEmbedding(query);

    // get all documents
    const docs = await Document.find();

    // calculate similarity
    const results = docs
      .map(d => ({
        id: d._id,
        originalName: d.originalName,
        score: cosineSimilarity(queryEmbedding, d.embedding || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // top 10

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ===============================
   5. DELETE DOCUMENT
   =============================== */
router.delete("/api/admin/document/:id", authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    // delete from GCS
    await bucket.file(doc.gcsPath).delete();

    // delete from DB
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
