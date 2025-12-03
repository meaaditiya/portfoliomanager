const express = require("express");
const multer = require("multer")();
const authenticateToken = require("../middlewares/authMiddleware");
const bucket = require("../services/gcs");
const Document = require("../models/Document");
const { generateQueryEmbedding, cosineSimilarity } = require("../services/embeddingService");

const router = express.Router();





router.post("/api/admin/folder/create", authenticateToken, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    
    if (!name) return res.status(400).json({ message: "Folder name required" });

    
    if (parentId) {
      const parent = await Document.findById(parentId);
      if (!parent) return res.status(404).json({ message: "Parent folder not found" });
      if (parent.type !== "folder") return res.status(400).json({ message: "Parent must be a folder" });
    }

    
    const existing = await Document.findOne({
      name,
      parent: parentId || null,
      type: "folder"
    });
    
    if (existing) return res.status(400).json({ message: "Folder with this name already exists" });

    const folder = await Document.create({
      name,
      type: "folder",
      parent: parentId || null,
      createdBy: req.user.id
    });

    res.json({ message: "Folder created", folder });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.post("/api/admin/document/upload", authenticateToken, multer.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { parentId } = req.body;
    
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    
    if (parentId) {
      const parent = await Document.findById(parentId);
      if (!parent) return res.status(404).json({ message: "Parent folder not found" });
      if (parent.type !== "folder") return res.status(400).json({ message: "Parent must be a folder" });
    }

    const storedName = Date.now() + "-" + file.originalname;
    const gcsFile = bucket.file(storedName);

    
    await gcsFile.save(file.buffer, { resumable: false });

    
    const embedding = await generateQueryEmbedding(file.originalname);

    
    const doc = await Document.create({
      name: file.originalname,
      type: "file",
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
      gcsPath: storedName,
      embedding,
      parent: parentId || null,
      createdBy: req.user.id
    });

    res.json({ message: "Uploaded", id: doc._id, document: doc });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get("/api/folder/contents", async (req, res) => {
  try {
    const { parentId } = req.query;

    
    const items = await Document.find({
      parent: parentId || null
    }).select("-embedding").sort({ type: 1, name: 1 }); 

    
    let currentFolder = null;
    if (parentId) {
      currentFolder = await Document.findById(parentId).select("-embedding");
      if (!currentFolder) return res.status(404).json({ message: "Folder not found" });
    }

    res.json({
      currentFolder,
      items,
      path: currentFolder ? currentFolder.path : "/"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get("/api/item/:id", async (req, res) => {
  try {
    const item = await Document.findById(req.params.id)
      .populate("parent", "name type path")
      .select("-embedding");
      
    if (!item) return res.status(404).json({ message: "Not found" });

    res.json(item);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get("/api/item/:id/breadcrumb", async (req, res) => {
  try {
    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });

    const breadcrumb = [];
    let current = item;

    while (current) {
      breadcrumb.unshift({
        id: current._id,
        name: current.name,
        type: current.type
      });
      
      if (current.parent) {
        current = await Document.findById(current.parent);
      } else {
        current = null;
      }
    }

    res.json({ breadcrumb });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get("/api/search", async (req, res) => {
  try {
    const { q, type } = req.query; 
    
    if (!q) return res.status(400).json({ message: "Query missing" });

    
    const folderQuery = { type: "folder", name: { $regex: q, $options: "i" } };
    const folders = type === "file" || type === "link" ? [] : await Document.find(folderQuery)
      .populate("parent", "name type")
      .select("-embedding")
      .limit(5);

    
    let files = [];
    if (type !== "folder" && type !== "link") {
      const queryEmbedding = await generateQueryEmbedding(q);
      const allFiles = await Document.find({ type: "file" }).populate("parent", "name type");

      files = allFiles
        .map(f => ({
          ...f.toObject(),
          score: cosineSimilarity(queryEmbedding, f.embedding || [])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(f => {
          delete f.embedding;
          return f;
        });
    }

    
    let links = [];
    if (type !== "folder" && type !== "file") {
      const queryEmbedding = await generateQueryEmbedding(q);
      const allLinks = await Document.find({ type: "link" }).populate("parent", "name type");

      links = allLinks
        .map(l => ({
          ...l.toObject(),
          score: cosineSimilarity(queryEmbedding, l.embedding || [])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(l => {
          delete l.embedding;
          return l;
        });
    }

    res.json({
      folders,
      files,
      links,
      query: q
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 




router.get("/api/download/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.type !== "file") return res.status(400).json({ message: "Cannot download a folder" });

    const file = bucket.file(doc.gcsPath);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 30 * 60 * 1000  
    });

    res.json({ downloadUrl: url, filename: doc.originalName });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.patch("/api/admin/item/:id/move", authenticateToken, async (req, res) => {
  try {
    const { newParentId } = req.body;
    const item = await Document.findById(req.params.id);
    
    if (!item) return res.status(404).json({ message: "Item not found" });

    
    if (newParentId) {
      const newParent = await Document.findById(newParentId);
      if (!newParent) return res.status(404).json({ message: "New parent folder not found" });
      if (newParent.type !== "folder") return res.status(400).json({ message: "New parent must be a folder" });
      
      
      if (item.type === "folder") {
        let checkParent = newParent;
        while (checkParent) {
          if (checkParent._id.toString() === item._id.toString()) {
            return res.status(400).json({ message: "Cannot move folder into itself or its children" });
          }
          checkParent = checkParent.parent ? await Document.findById(checkParent.parent) : null;
        }
      }
    }

    item.parent = newParentId || null;
    await item.save();

    
    if (item.type === "folder") {
      await updateChildrenPaths(item._id);
    }

    res.json({ message: "Moved successfully", item });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


async function updateChildrenPaths(folderId) {
  const children = await Document.find({ parent: folderId });
  for (const child of children) {
    await child.save(); 
    if (child.type === "folder") {
      await updateChildrenPaths(child._id);
    }
  }
}





router.patch("/api/admin/item/:id/rename", authenticateToken, async (req, res) => {
  try {
    const { newName } = req.body;
    
    if (!newName) return res.status(400).json({ message: "New name required" });

    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    
    const existing = await Document.findOne({
      name: newName,
      parent: item.parent,
      type: item.type,
      _id: { $ne: item._id }
    });
    
    if (existing) return res.status(400).json({ message: "Item with this name already exists in this folder" });

    item.name = newName;
    await item.save();

    
    if (item.type === "folder") {
      await updateChildrenPaths(item._id);
    }

    res.json({ message: "Renamed successfully", item });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.delete("/api/admin/item/:id", authenticateToken, async (req, res) => {
  try {
    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });

    if (item.type === "folder") {
      
      const children = await Document.countDocuments({ parent: item._id });
      if (children > 0) {
        return res.status(400).json({ 
          message: "Cannot delete folder with contents. Delete or move contents first." 
        });
      }
    } else if (item.type === "file") {
      
      try {
        await bucket.file(item.gcsPath).delete();
      } catch (gcsErr) {
        console.error("GCS deletion error:", gcsErr);
      }
    }
    

    
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.delete("/api/admin/folder/:id/recursive", authenticateToken, async (req, res) => {
  try {
    const folder = await Document.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: "Folder not found" });
    if (folder.type !== "folder") return res.status(400).json({ message: "Not a folder" });

    
    await deleteRecursive(folder._id);

    res.json({ message: "Folder and all contents deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


async function deleteRecursive(folderId) {
  const children = await Document.find({ parent: folderId });
  
  for (const child of children) {
    if (child.type === "folder") {
      await deleteRecursive(child._id);
    } else if (child.type === "file") {
      
      try {
        await bucket.file(child.gcsPath).delete();
      } catch (gcsErr) {
        console.error("GCS deletion error:", gcsErr);
      }
    }
    
    await Document.findByIdAndDelete(child._id);
  }
  
  
  await Document.findByIdAndDelete(folderId);
}




router.get("/api/folder/tree", async (req, res) => {
  try {
    const { rootId } = req.query;

    const buildTree = async (parentId) => {
      const items = await Document.find({ parent: parentId || null })
        .select("-embedding")
        .sort({ type: 1, name: 1 });

      const tree = [];
      for (const item of items) {
        const node = item.toObject();
        if (item.type === "folder") {
          node.children = await buildTree(item._id);
        }
        tree.push(node);
      }
      return tree;
    };

    const tree = await buildTree(rootId);
    res.json({ tree });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/api/admin/link/create", authenticateToken, async (req, res) => {
  try {
    const { name, url, parentId } = req.body;
    
    if (!name) return res.status(400).json({ message: "Link name required" });
    if (!url) return res.status(400).json({ message: "URL required" });

    
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ message: "Invalid URL format" });
    }

    
    if (parentId) {
      const parent = await Document.findById(parentId);
      if (!parent) return res.status(404).json({ message: "Parent folder not found" });
      if (parent.type !== "folder") return res.status(400).json({ message: "Parent must be a folder" });
    }

    
    const existing = await Document.findOne({
      name,
      parent: parentId || null,
      type: "link"
    });
    
    if (existing) return res.status(400).json({ message: "Link with this name already exists" });

    
    const embedding = await generateQueryEmbedding(name + " " + url);

    
    const link = await Document.create({
      name,
      type: "link",
      url,
      mimeType: "link",
      storedName: name,
      embedding,
      parent: parentId || null,
      createdBy: req.user.id
    });

    res.json({ message: "Link created", link });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;