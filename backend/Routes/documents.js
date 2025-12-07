const express = require("express");
const multer = require("multer")();
const XLSX = require("xlsx"); 
const jwt = require('jsonwebtoken');
const authenticateToken = require("../middlewares/authMiddleware");
const bucket = require("../services/gcs");
const Document = require("../models/Document");
const { generateQueryEmbedding, cosineSimilarity } = require("../services/embeddingService");
const User = require("../models/userSchema"); 
const router = express.Router();


const optionalAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      
      const userId = decoded.user_id;
      
      if (userId) {
        
        req.user = { 
          id: String(userId),
          _id: String(userId)
        };
      }
    } catch (err) {
      
      console.error('Token verification failed:', err.message);
    }
  }
  next();
};

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





router.get("/api/excel/:id/data", optionalAuth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    
    const userIdString = req.user ? String(req.user.id) : null;

    const response = {
      id: doc._id,
      name: doc.name,
      sheetNames: doc.sheetNames,
      rowCount: doc.rowCount,
      columnCount: doc.columnCount,
      data: doc.jsonData,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      checkmarkFields: doc.excelCheckmarkFields || [],
      userCheckmarks: userIdString ? (doc.rowCheckmarks?.[userIdString] || {}) : {},
      isAuthenticated: !!req.user
    };

    res.json(response);

  } catch (err) {
    console.error("Excel data error:", err);
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





router.get("/api/folder/contents", optionalAuth, async (req, res) => {
  try {
    const { parentId } = req.query;

    const items = await Document.find({
      parent: parentId || null
    })
    .select("-embedding -jsonData -rowCheckmarks")
    .sort({ type: 1, name: 1 });

    let currentFolder = null;
    if (parentId) {
      currentFolder = await Document.findById(parentId)
        .select("-embedding -jsonData -rowCheckmarks");
      if (!currentFolder) {
        return res.status(404).json({ message: "Folder not found" });
      }
    }
const itemsWithBookmarkStatus = items.map(item => {
  const itemObj = item.toObject();
  
  
  const isBookmarked = req.user 
    ? item.bookmarks.some(b => String(b.userId) === String(req.user.id))
    : false;

  return {
    ...itemObj,
    isBookmarked,
    bookmarkEnabled: item.bookmarkEnabled || false,
    isAuthenticated: !!req.user,
    bookmarks: undefined 
  };
});

    res.json({
      currentFolder,
      items: itemsWithBookmarkStatus,
      path: currentFolder ? currentFolder.path : "/",
      isAuthenticated: !!req.user
    });

  } catch (err) {
    console.error("Folder contents error:", err);
    res.status(500).json({ error: err.message });
  }
});





router.get("/api/item/:id", optionalAuth, async (req, res) => {
  try {
    const item = await Document.findById(req.params.id)
      .populate("parent", "name type path")
      .select("-embedding -jsonData -rowCheckmarks");
      
    if (!item) return res.status(404).json({ message: "Not found" });

    const itemObj = item.toObject();
    const isBookmarked = req.user 
      ? item.bookmarks.some(b => b.userId === req.user._id)
      : false;

    const response = {
      ...itemObj,
      isBookmarked,
      bookmarkEnabled: item.bookmarkEnabled || false,
      bookmarkCount: item.bookmarks.length,
      isAuthenticated: !!req.user,
      bookmarks: undefined 
    };

    if (item.type === "excel") {
      response.checkmarkFields = item.excelCheckmarkFields || [];
    }

    res.json(response);

  } catch (err) {
    console.error("Get item error:", err);
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





router.get("/api/search", optionalAuth, async (req, res) => {
  try {
    const { 
      q, 
      parentId,  
      limit = 10 
    } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Query missing" });
    }

    const normalizedQuery = q.trim();
    const limitNum = parseInt(limit) || 10;
    
    
    let queryEmbedding;
    try {
      queryEmbedding = await generateQueryEmbedding(normalizedQuery);
    } catch (err) {
      console.error('Embedding generation failed:', err);
      return res.status(500).json({ message: "Search failed" });
    }

    
    let folderMatch = {};
    if (parentId) {
      
      const descendants = await getAllDescendantIds(parentId);
      folderMatch = { 
        $or: [
          { parent: parentId },
          { parent: { $in: descendants } }
        ]
      };
    }

    
    const vectorCandidates = await Document.find({
      ...folderMatch,
      embedding: { $exists: true, $ne: [] }
    })
    .select("name originalName type url mimeType size parent embedding rowCount createdAt updatedAt bookmarkEnabled bookmarks")
    .populate("parent", "name type")
    .limit(200)
    .lean();

    
    const textRegex = new RegExp(normalizedQuery.split(' ').map(escapeRegex).join('|'), 'i');
    const textCandidates = await Document.find({
      ...folderMatch,
      $or: [
        { name: textRegex },
        { originalName: textRegex }
      ]
    })
    .select("name originalName type url mimeType size parent embedding rowCount createdAt updatedAt bookmarkEnabled bookmarks")
    .populate("parent", "name type")
    .limit(100)
    .lean();

    
    const idToDoc = new Map();
    
    
    for (const doc of vectorCandidates) {
      const id = doc._id.toString();
      let vectorSim = 0;
      if (doc.embedding && doc.embedding.length > 0) {
        try {
          vectorSim = cosineSimilarity(queryEmbedding, doc.embedding);
        } catch (e) {
          console.error('Cosine similarity error:', e);
        }
      }
      idToDoc.set(id, { doc, vectorSim, textScore: 0 });
    }

    
    for (const doc of textCandidates) {
      const id = doc._id.toString();
      const textScore = calculateTextScore(doc, normalizedQuery);
      
      if (idToDoc.has(id)) {
        idToDoc.get(id).textScore = textScore;
      } else {
        idToDoc.set(id, { doc, vectorSim: 0, textScore });
      }
    }

    
    const merged = Array.from(idToDoc.values());
    
    const maxVec = Math.max(...merged.map(m => m.vectorSim), 0.001);
    const maxText = Math.max(...merged.map(m => m.textScore), 0.001);

    merged.forEach(m => {
      m.vectorNorm = m.vectorSim / maxVec;
      m.textNorm = m.textScore / maxText;
      m.fusedScore = 0.7 * m.vectorNorm + 0.3 * m.textNorm; 
    });

    
    merged.sort((a, b) => b.fusedScore - a.fusedScore);
    const topResults = merged.slice(0, limitNum);

    const userIdString = req.user ? String(req.user.id) : null;
    const results = topResults.map(item => {
      const doc = item.doc;
      const isBookmarked = userIdString 
        ? doc.bookmarks?.some(b => String(b.userId) === userIdString)
        : false;

      return {
        _id: doc._id,
        name: doc.name,
        originalName: doc.originalName,
        type: doc.type,
        url: doc.url,
        mimeType: doc.mimeType,
        size: doc.size,
        rowCount: doc.rowCount,
        parent: doc.parent,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        bookmarkEnabled: doc.bookmarkEnabled || false,
        isBookmarked,
        relevanceScore: item.fusedScore,
        vectorScore: item.vectorSim,
        textScore: item.textScore
      };
    });

    const processingTime = Date.now() - startTime;

    
    res.json({
      results,  
      searchMetadata: {
        query: normalizedQuery,
        totalResults: results.length,
        processingTime: `${processingTime}ms`,
        searchType: 'hybrid_vector_text',
        inFolder: !!parentId
      }
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function getAllDescendantIds(parentId) {
  const descendants = [];
  const queue = [parentId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await Document.find({ 
      parent: currentId, 
      type: 'folder' 
    }).select('_id').lean();
    
    for (const child of children) {
      descendants.push(child._id);
      queue.push(child._id);
    }
  }
  
  return descendants;
}


function calculateTextScore(doc, query) {
  const queryLower = query.toLowerCase();
  const nameLower = (doc.name || '').toLowerCase();
  const originalNameLower = (doc.originalName || '').toLowerCase();
  
  let score = 0;
  
  
  if (nameLower === queryLower || originalNameLower === queryLower) {
    score += 10;
  }
  
  else if (nameLower.startsWith(queryLower) || originalNameLower.startsWith(queryLower)) {
    score += 5;
  }
  
  else if (nameLower.includes(queryLower) || originalNameLower.includes(queryLower)) {
    score += 3;
  }
  
  
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (nameLower.includes(word)) score += 1;
    if (originalNameLower.includes(word)) score += 1;
  });
  
  return score;
}


function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}




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






router.patch("/api/admin/item/:id/bookmark-toggle", authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: "enabled field must be boolean" });
    }

    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.bookmarkEnabled = enabled;
    await item.save();

    res.json({ 
      message: `Bookmarking ${enabled ? 'enabled' : 'disabled'}`,
      item: {
        id: item._id,
        name: item.name,
        bookmarkEnabled: item.bookmarkEnabled
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});







router.post("/api/admin/excel/:id/checkmark-fields", authenticateToken, async (req, res) => {
  try {
    const { fields } = req.body; 
    
    if (!Array.isArray(fields)) {
      return res.status(400).json({ message: "fields must be an array" });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    
    for (const field of fields) {
      if (!field.fieldName || !field.fieldId) {
        return res.status(400).json({ 
          message: "Each field must have fieldName and fieldId" 
        });
      }
    

    if (field.checkmarkType && !['checkbox', 'check', 'circle', 'star', 'heart'].includes(field.checkmarkType)) {
    return res.status(400).json({
      message: "Invalid checkmarkType. Must be one of: checkbox, check, circle, star, heart"
    });
  }
    }
    doc.excelCheckmarkFields = fields.map(f => ({
      fieldName: f.fieldName,
      fieldId: f.fieldId,
      checkmarkType: f.checkmarkType || 'checkbox', 
      createdAt: new Date()
    }));

    await doc.save();

    res.json({ 
      message: "Checkmark fields updated",
      fields: doc.excelCheckmarkFields
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete("/api/admin/excel/:id/checkmark-field/:fieldId", authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    const fieldId = req.params.fieldId;
    doc.excelCheckmarkFields = doc.excelCheckmarkFields.filter(
      f => f.fieldId !== fieldId
    );

    
    if (doc.rowCheckmarks) {
      Object.keys(doc.rowCheckmarks).forEach(userId => {
        Object.keys(doc.rowCheckmarks[userId]).forEach(rowIndex => {
          if (doc.rowCheckmarks[userId][rowIndex][fieldId]) {
            delete doc.rowCheckmarks[userId][rowIndex][fieldId];
          }
        });
      });
    }

    await doc.save();

    res.json({ 
      message: "Checkmark field removed",
      fields: doc.excelCheckmarkFields
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});







router.post("/api/user/bookmark/:id", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id; 

      if (!userId) {
        return res.status(403).json({ message: "Invalid user token" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (!item.bookmarkEnabled) {
      return res.status(403).json({ 
        message: "Bookmarking is not enabled for this item" 
      });
    }

    
    const userIdString = String(userId);
    const existingBookmark = item.bookmarks.find(
      b => String(b.userId) === userIdString
    );

    if (existingBookmark) {
      return res.status(400).json({ message: "Already bookmarked" });
    }

    item.bookmarks.push({
      userId: userIdString, 
      bookmarkedAt: new Date()
    });

    await item.save();

    res.json({ 
      message: "Bookmarked successfully",
      bookmarked: true,
      bookmarkCount: item.bookmarks.length
    });

  } catch (err) {
    console.error("Bookmark error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/user/bookmark/:id", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id; 

      if (!userId) {
        return res.status(403).json({ message: "Invalid user token" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    
    const userIdString = String(userId);
    const bookmarkIndex = item.bookmarks.findIndex(
      b => String(b.userId) === userIdString
    );

    if (bookmarkIndex > -1) {
      item.bookmarks.splice(bookmarkIndex, 1);
      await item.save();
    }

    res.json({ 
      message: "Bookmark removed",
      bookmarked: false,
      bookmarkCount: item.bookmarks.length
    });

  } catch (err) {
    console.error("Unbookmark error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/user/bookmarks", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id; 

      if (!userId) {
        return res.status(403).json({ message: "Invalid user token" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    
    const userIdString = String(userId);
    const bookmarkedItems = await Document.find({
      "bookmarks.userId": userIdString
    })
    .select("-embedding -jsonData -rowCheckmarks")
    .populate("parent", "name type")
    .sort({ updatedAt: -1 });

    const itemsWithBookmarkDate = bookmarkedItems.map(item => {
      const bookmark = item.bookmarks.find(b => String(b.userId) === userIdString);
      return {
        ...item.toObject(),
        bookmarkedAt: bookmark?.bookmarkedAt,
        bookmarks: undefined 
      };
    });

    res.json({ 
      bookmarks: itemsWithBookmarkDate,
      count: itemsWithBookmarkDate.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/api/user/excel/:id/row-checkmark", async (req, res) => {
  try {
    const { rowIndex, fieldId, checked } = req.body;

    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id; 

      if (!userId) {
        return res.status(403).json({ message: "Invalid user token" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (typeof rowIndex !== 'number' || typeof checked !== 'boolean') {
      return res.status(400).json({ 
        message: "rowIndex (number) and checked (boolean) required" 
      });
    }

    if (!fieldId) {
      return res.status(400).json({ message: "fieldId is required" });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    const fieldExists = doc.excelCheckmarkFields.some(f => f.fieldId === fieldId);
    if (!fieldExists) {
      return res.status(400).json({ 
        message: "Invalid fieldId. Field does not exist." 
      });
    }

    if (!doc.rowCheckmarks) doc.rowCheckmarks = {};
    
    
    const userIdString = String(userId);
    
    if (!doc.rowCheckmarks[userIdString]) {
      doc.rowCheckmarks[userIdString] = {};
    }
    if (!doc.rowCheckmarks[userIdString][rowIndex]) {
      doc.rowCheckmarks[userIdString][rowIndex] = {};
    }

    doc.rowCheckmarks[userIdString][rowIndex][fieldId] = checked;

    doc.markModified('rowCheckmarks');
    await doc.save();

    res.json({ 
      message: "Checkmark updated",
      rowIndex,
      fieldId,
      checked
    });

  } catch (err) {
    console.error("Row checkmark error:", err);
    res.status(500).json({ error: err.message });
  }
});
router.get("/api/user/excel/:id/checkmarks", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id; 

      if (!userId) {
        return res.status(403).json({ message: "Invalid user token" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const doc = await Document.findById(req.params.id)
      .select("excelCheckmarkFields rowCheckmarks name type");

    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    
    const userIdString = String(userId);
    const userCheckmarks = doc.rowCheckmarks?.[userIdString] || {};

    res.json({ 
      checkmarkFields: doc.excelCheckmarkFields || [],
      userCheckmarks
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.patch("/api/admin/excel/:id/edit", authenticateToken, async (req, res) => {
  try {
    const { action, data } = req.body;
    const doc = await Document.findById(req.params.id);
    
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    const { sheetName, rowIndex, columnName, newValue, newColumnName, newRowData } = data;

    switch (action) {
      case 'UPDATE_CELL':
        
        if (!doc.jsonData[sheetName] || doc.jsonData[sheetName][rowIndex] === undefined) {
          return res.status(400).json({ message: "Invalid sheet or row" });
        }
        doc.jsonData[sheetName][rowIndex][columnName] = newValue;
        break;

      case 'UPDATE_HEADER':
        
        if (!doc.jsonData[sheetName]) {
          return res.status(400).json({ message: "Invalid sheet" });
        }
        doc.jsonData[sheetName] = doc.jsonData[sheetName].map(row => {
          const newRow = {};
          Object.keys(row).forEach(key => {
            newRow[key === columnName ? newColumnName : key] = row[key];
          });
          return newRow;
        });
        break;

      case 'DELETE_ROW':
        
        if (!doc.jsonData[sheetName]) {
          return res.status(400).json({ message: "Invalid sheet" });
        }
        doc.jsonData[sheetName].splice(rowIndex, 1);
        doc.rowCount = Math.max(0, (doc.rowCount || 0) - 1);
        break;

      case 'DELETE_COLUMN':
        
        if (!doc.jsonData[sheetName]) {
          return res.status(400).json({ message: "Invalid sheet" });
        }
        doc.jsonData[sheetName] = doc.jsonData[sheetName].map(row => {
          const newRow = { ...row };
          delete newRow[columnName];
          return newRow;
        });
        
        if (doc.jsonData[sheetName].length > 0) {
          doc.columnCount = Object.keys(doc.jsonData[sheetName][0]).length;
        }
        break;

      case 'ADD_ROW':
        
        if (!doc.jsonData[sheetName]) {
          return res.status(400).json({ message: "Invalid sheet" });
        }
        const headers = doc.jsonData[sheetName].length > 0 
          ? Object.keys(doc.jsonData[sheetName][0])
          : [];
        const emptyRow = {};
        headers.forEach(h => emptyRow[h] = '');
        doc.jsonData[sheetName].push(newRowData || emptyRow);
        doc.rowCount = (doc.rowCount || 0) + 1;
        break;

      case 'ADD_COLUMN':
        
        if (!doc.jsonData[sheetName]) {
          return res.status(400).json({ message: "Invalid sheet" });
        }
        const colName = newColumnName || `Column_${Date.now()}`;
        doc.jsonData[sheetName] = doc.jsonData[sheetName].map(row => ({
          ...row,
          [colName]: ''
        }));
        doc.columnCount = (doc.columnCount || 0) + 1;
        break;

      case 'UPDATE_SHEET':
        
        if (!data.sheetData) {
          return res.status(400).json({ message: "Sheet data required" });
        }
        doc.jsonData[sheetName] = data.sheetData;
        doc.rowCount = data.sheetData.length;
        doc.columnCount = data.sheetData.length > 0 ? Object.keys(data.sheetData[0]).length : 0;
        break;

      default:
        return res.status(400).json({ message: "Invalid action" });
    }

    doc.markModified('jsonData');
    doc.updatedAt = new Date();
    await doc.save();

    res.json({ 
      message: "Excel data updated successfully",
      data: doc.jsonData[sheetName],
      rowCount: doc.rowCount,
      columnCount: doc.columnCount
    });

  } catch (err) {
    console.error("Excel edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;