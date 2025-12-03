const express = require("express");
const multer = require("multer")();
const XLSX = require("xlsx"); 
const authenticateToken = require("../middlewares/authMiddleware");
const bucket = require("../services/gcs");
const Document = require("../models/Document");
const { generateQueryEmbedding, cosineSimilarity } = require("../services/embeddingService");

const router = express.Router();




router.post("/api/admin/excel/upload", authenticateToken, multer.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { parentId } = req.body;
    
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    
    const validMimeTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv"
    ];
    
    if (!validMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "Only Excel (.xlsx, .xls) or CSV files are allowed" });
    }

    
    if (parentId) {
      const parent = await Document.findById(parentId);
      if (!parent) return res.status(404).json({ message: "Parent folder not found" });
      if (parent.type !== "folder") return res.status(400).json({ message: "Parent must be a folder" });
    }

    
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    
    const sheetNames = workbook.SheetNames;
    const jsonData = {};
    let totalRows = 0;
    let maxColumns = 0;
    
  sheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  
  
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  
  
  const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
  
  if (range && json.length > 0) {
    
    const dataWithLinks = json.map((row, rowIndex) => {
      const newRow = { ...row };
      
      
      const headers = Object.keys(row);
      
      headers.forEach((header, colIndex) => {
        
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
        const cell = worksheet[cellAddress];
        
        
        if (cell && cell.l && cell.l.Target) {
          
          newRow[header] = cell.l.Target;
        }
        
        else if (cell && cell.f && typeof cell.f === 'string') {
          const hyperlinkMatch = cell.f.match(/HYPERLINK\("([^"]+)"/i);
          if (hyperlinkMatch && hyperlinkMatch[1]) {
            newRow[header] = hyperlinkMatch[1];
          }
        }
      });
      
      return newRow;
    });
    
    
    const filteredData = dataWithLinks.map(row => {
      const filteredRow = {};
      Object.keys(row).forEach(key => {
        
        const hasValue = dataWithLinks.some(r => {
          const val = r[key];
          return val !== null && val !== undefined && val !== '';
        });
        if (hasValue) {
          filteredRow[key] = row[key];
        }
      });
      return filteredRow;
    });
    
    jsonData[sheetName] = filteredData;
    totalRows += filteredData.length;
    
    if (filteredData.length > 0) {
      const colCount = Object.keys(filteredData[0]).length;
      if (colCount > maxColumns) maxColumns = colCount;
    }
  } else {
    
    jsonData[sheetName] = json;
    totalRows += json.length;
    if (json.length > 0) {
      const colCount = Object.keys(json[0]).length;
      if (colCount > maxColumns) maxColumns = colCount;
    }
  }
});
    
    const embedding = await generateQueryEmbedding(file.originalname);

    
    const existing = await Document.findOne({
      name: file.originalname,
      parent: parentId || null,
      type: "excel"
    });
    
    if (existing) {
      return res.status(400).json({ message: "Excel file with this name already exists in this folder" });
    }

    
    const doc = await Document.create({
      name: file.originalname,
      type: "excel",
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      jsonData,
      sheetNames,
      rowCount: totalRows,
      columnCount: maxColumns,
      embedding,
      parent: parentId || null,
      createdBy: req.user.id
    });

    res.json({ 
      message: "Excel file uploaded and converted to JSON", 
      id: doc._id,
      sheetNames,
      rowCount: totalRows,
      columnCount: maxColumns
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get("/api/excel/:id/data", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") return res.status(400).json({ message: "This is not an Excel file" });

    res.json({
      id: doc._id,
      name: doc.name,
      sheetNames: doc.sheetNames,
      rowCount: doc.rowCount,
      columnCount: doc.columnCount,
      data: doc.jsonData,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get("/api/excel/:id/metadata", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .select("-jsonData -embedding")
      .populate("parent", "name type path");
    
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") return res.status(400).json({ message: "This is not an Excel file" });

    res.json(doc);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




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
    })
    .select("-embedding -jsonData")  
    .sort({ type: 1, name: 1 });

    let currentFolder = null;
    if (parentId) {
      currentFolder = await Document.findById(parentId).select("-embedding -jsonData");
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
      .select("-embedding -jsonData");  
      
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
    const folders = type === "file" || type === "link" || type === "excel" 
      ? [] 
      : await Document.find(folderQuery)
          .populate("parent", "name type")
          .select("-embedding -jsonData")
          .limit(5);

    
    let files = [];
    if (type !== "folder" && type !== "link" && type !== "excel") {
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
    if (type !== "folder" && type !== "file" && type !== "excel") {
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

    
    let excels = [];
    if (type !== "folder" && type !== "file" && type !== "link") {
      const queryEmbedding = await generateQueryEmbedding(q);
      const allExcels = await Document.find({ type: "excel" })
        .select("-jsonData")  
        .populate("parent", "name type");

      excels = allExcels
        .map(e => ({
          ...e.toObject(),
          score: cosineSimilarity(queryEmbedding, e.embedding || [])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(e => {
          delete e.embedding;
          return e;
        });
    }

    res.json({
      folders,
      files,
      links,
      excels,  
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
    if (doc.type !== "file") return res.status(400).json({ message: "Cannot download this item type" });

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
        .select("-embedding -jsonData")
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