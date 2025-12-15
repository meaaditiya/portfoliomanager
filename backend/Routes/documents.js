const express = require("express");
const multer = require("multer")();
const XLSX = require("xlsx"); 
const jwt = require('jsonwebtoken');
const authenticateToken = require("../middlewares/authMiddleware");
const bucket = require("../services/gcs");
const{Document, AccessRequest} = require("../models/Document");
const { generateQueryEmbedding, cosineSimilarity } = require("../services/embeddingService");
const User = require("../models/userSchema"); 
const sendEmail = require("../utils/email");
const getReplyEmailTemplate2 = require("../EmailTemplates/getReplyTemplate2");
const router = express.Router();
const ADMIN_EMAIL= process.env.FROM_EMAIL;
const crypto = require('crypto');
const https = require('https');
const BlacklistedToken = require("../models/blacklistedtoken");

const verifyTurnstile = async (token) => {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token
    }).toString();

    const options = {
      hostname: 'challenges.cloudflare.com',
      port: 443,
      path: '/turnstile/v0/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Turnstile verification response:', response);
          resolve(response.success === true);
        } catch (error) {
          console.error('Error parsing Turnstile response:', error);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Turnstile request error:', error);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
};
const verifyTurnstileToken = async (req, res, next) => {
  const turnstileToken = req.headers['x-turnstile-token'] || req.body.turnstileToken || req.query.turnstileToken;
  
  if (!turnstileToken) {
    return res.status(403).json({ 
      message: 'Turnstile verification required',
      requiresTurnstile: true 
    });
  }

  const isValid = await verifyTurnstile(turnstileToken);
  
  if (!isValid) {
    return res.status(403).json({ 
      message: 'Turnstile verification failed',
      requiresTurnstile: true 
    });
  }

  next();
};
const optionalAuth = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      const blacklisted = await BlacklistedToken.findOne({ token });
      if (blacklisted) {
        req.user = { 
          isAuthenticated: false,
          isAdmin: false,
          isPremium: false
        };
        return next();
      }
      
      // Check if this is an admin token
      const isAdminToken = !!decoded.admin_id || decoded.role === 'admin';
      
      if (isAdminToken) {
        // Admin token - don't look up in User collection
        req.user = {
          id: String(decoded.admin_id),
          _id: String(decoded.admin_id),
          email: decoded.email,
          name: decoded.name,
          isAdmin: true,
          isPremium: true, // Admins always count as premium
          isAuthenticated: true,
          type: 'admin'
        };
      } else {
        // Regular user token - look up in User collection
        const userId = decoded.user_id;
        
        if (userId) {
          const user = await User.findById(userId);
          
          if (user) {
            req.user = {
              id: String(userId),
              _id: String(userId),
              email: user.email,
              name: user.name,
              isAdmin: false,
              isPremium: user.isPremium || false,
              isAuthenticated: true,
              type: 'user'
            };
          } else {
            req.user = { 
              isAuthenticated: false,
              isAdmin: false,
              isPremium: false
            };
          }
        } else {
          req.user = { 
            isAuthenticated: false,
            isAdmin: false,
            isPremium: false
          };
        }
      }
    } catch (err) {
      console.error('Token verification failed:', err.message);
      req.user = { 
        isAuthenticated: false,
        isAdmin: false,
        isPremium: false
      };
    }
  } else {
    req.user = { 
      isAuthenticated: false,
      isAdmin: false,
      isPremium: false
    };
  }
  
  next();
};
const checkFullPathAccess = async (documentId, userId, linkId = null, isAdmin = false, isPremium = false) => {
  if (isAdmin || isPremium) {
    return { hasAccess: true };
  }

  const doc = await Document.findById(documentId);
  if (!doc) return { hasAccess: false, reason: 'Document not found' };

  const path = [];
  let current = doc;
  
  while (current) {
    path.unshift(current);
    if (current.parent) {
      current = await Document.findById(current.parent);
    } else {
      current = null;
    }
  }

  for (const ancestor of path) {
    if (ancestor.accessLevel === 'locked') {
      return { hasAccess: false, reason: 'Parent folder is locked', lockedItem: ancestor.name };
    }

    if (ancestor.accessLevel === 'private') {
      let ancestorHasAccess = false;

      if (linkId) {
        const link = ancestor.privateAccessLinks.find(l => 
          l.linkId === linkId && 
          l.isActive && 
          (!l.expiresAt || l.expiresAt > new Date()) &&
          (!l.maxAccessCount || l.accessCount < l.maxAccessCount)
        );
        if (link) ancestorHasAccess = true;
      }

      if (!ancestorHasAccess && userId) {
        const granted = ancestor.grantedUsers.find(g => 
          g.userId.toString() === userId.toString()
        );
        if (granted) ancestorHasAccess = true;
      }

      if (!ancestorHasAccess) {
        return { hasAccess: false, reason: 'Parent folder is private', privateItem: ancestor.name };
      }
    }
  }

  return { hasAccess: true };
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

router.get("/api/excel/:id/data", optionalAuth, async (req, res) => {
  try {
    const { key } = req.query;
    
    const isAdmin = req.user?.isAdmin || false;
    const isPremium = req.user?.isPremium || false;
    if (!isAdmin && !isPremium) {
      const turnstileToken = req.headers['x-turnstile-token'] || req.body.turnstileToken || req.query.turnstileToken;
      
      if (!turnstileToken) {
        return res.status(403).json({ 
          message: 'Turnstile verification required',
          requiresTurnstile: true 
        });
      }

      const isValid = await verifyTurnstile(turnstileToken);
      
      if (!isValid) {
        return res.status(403).json({ 
          message: 'Turnstile verification failed',
          requiresTurnstile: true 
        });
      }
    }
    
    const doc = await Document.findById(req.params.id);
    
    if (!doc) return res.status(404).json({ message: "Excel file not found" });
    if (doc.type !== "excel") {
      return res.status(400).json({ message: "This is not an Excel file" });
    }

    const userIdString = req.user ? String(req.user.id) : null;
    
  const accessCheck = await checkFullPathAccess(req.params.id, userIdString, key, isAdmin, isPremium);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({
        message: accessCheck.reason,
        documentInfo: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          size: doc.size
        },
        canRequestAccess: true,
        details: accessCheck.lockedItem || accessCheck.privateItem
      });
    }

    if (key) {
      const link = doc.privateAccessLinks.find(l => l.linkId === key);
      if (link && link.isActive) {
        link.accessCount += 1;
        await doc.save();
      }
    }

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
      isAuthenticated: !!req.user,
      accessLevel: doc.accessLevel,
      isAdmin
    };

    res.json(response);

  } catch (err) {
    console.error("Excel data error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/api/folder/contents", optionalAuth, async (req, res) => {
  try {
    const { parentId, key } = req.query;
    const userIdString = req.user ? String(req.user.id) : null;
    const isAdmin = req.user?.isAdmin || false;
const isPremium = req.user?.isPremium || false;
   if (parentId && !isAdmin && !isPremium) {
      const accessCheck = await checkFullPathAccess(parentId, userIdString, key, isAdmin);
      
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          message: accessCheck.reason,
          details: accessCheck.lockedItem || accessCheck.privateItem,
          canRequestAccess: true
        });
      }
    }

    const items = await Document.find({
      parent: parentId || null
    })
    .select("-embedding -jsonData -rowCheckmarks")
    .sort({ type: 1, name: 1 });

    let currentFolder = null;
    if (parentId) {
      currentFolder = await Document.findById(parentId)
        .select("-embedding -jsonData -rowCheckmarks");
    }

    const itemsWithAccess = await Promise.all(items.map(async (item) => {
      const itemObj = item.toObject();
      
    const itemAccessCheck = await checkFullPathAccess(item._id, userIdString, key, isAdmin, isPremium);
      
      const isBookmarked = req.user 
        ? item.bookmarks.some(b => String(b.userId) === String(req.user.id))
        : false;

      if (!itemAccessCheck.hasAccess) {
        return {
          _id: itemObj._id,
          name: itemObj.name,
          type: itemObj.type,
          size: itemObj.size,
          accessLevel: item.accessLevel,
          createdAt: itemObj.createdAt,
          hasAccess: false,
          canRequestAccess: true,
          accessDeniedReason: itemAccessCheck.reason
        };
      }

      return {
        _id: itemObj._id,
        name: itemObj.name,
        originalName: itemObj.originalName,
        type: itemObj.type,
        url: itemObj.url,
        mimeType: itemObj.mimeType,
        size: itemObj.size,
        rowCount: itemObj.rowCount,
        parent: itemObj.parent,
        path: itemObj.path,
        createdAt: itemObj.createdAt,
        updatedAt: itemObj.updatedAt,
        bookmarkEnabled: item.bookmarkEnabled || false,
        isBookmarked,
        hasAccess: true,
        accessLevel: item.accessLevel,
        bookmarkCount: item.bookmarks?.length || 0
      };
    }));

    let currentFolderResponse = null;
    if (currentFolder) {
      currentFolderResponse = {
        _id: currentFolder._id,
        name: currentFolder.name,
        type: currentFolder.type,
        parent: currentFolder.parent,
        path: currentFolder.path,
        createdAt: currentFolder.createdAt,
        updatedAt: currentFolder.updatedAt,
        bookmarkEnabled: currentFolder.bookmarkEnabled || false,
        accessLevel: currentFolder.accessLevel
      };
    }

    res.json({
      currentFolder: currentFolderResponse,
      items: itemsWithAccess,
      path: currentFolder ? currentFolder.path : "/",
      isAuthenticated: !!req.user,
      isAdmin
    });

  } catch (err) {
    console.error("Folder contents error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/api/item/:id", optionalAuth, async (req, res) => {
  try {
    const { key } = req.query;
    
    const item = await Document.findById(req.params.id)
      .populate("parent", "name type path")
      .select("-embedding -jsonData -rowCheckmarks");
      
    if (!item) return res.status(404).json({ message: "Not found" });

    const userIdString = req.user ? String(req.user.id) : null;
    const isAdmin = req.user?.isAdmin || false;
    const isPremium = req.user?.isPremium || false;
    const accessCheck = await checkFullPathAccess(req.params.id, userIdString, key, isAdmin, isPremium);
    const itemObj = item.toObject();
    const isBookmarked = req.user 
      ? item.bookmarks.some(b => String(b.userId) === String(req.user.id))
      : false;

    if (!accessCheck.hasAccess) {
      return res.status(403).json({
        message: accessCheck.reason,
        documentInfo: {
          id: itemObj._id,
          name: itemObj.name,
          type: itemObj.type,
          size: itemObj.size,
          accessLevel: item.accessLevel
        },
        canRequestAccess: true,
        details: accessCheck.lockedItem || accessCheck.privateItem
      });
    }

    const response = {
      ...itemObj,
      isBookmarked,
      bookmarkEnabled: item.bookmarkEnabled || false,
      bookmarkCount: item.bookmarks.length,
      isAuthenticated: !!req.user,
      bookmarks: undefined,
      hasAccess: true,
      accessLevel: item.accessLevel,
      isAdmin
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

router.get("/api/download/:id", optionalAuth, async (req, res) => {
  try {
    const { key, turnstileToken } = req.query;
    const isAdmin = req.user?.isAdmin || false;
    const isPremium = req.user?.isPremium || false;
    if (!isAdmin && !isPremium) {
      if (turnstileToken) {
        const isValid = await verifyTurnstile(turnstileToken);
        if (!isValid) {
          return res.status(403).json({ 
            message: 'Verification failed',
            requiresTurnstile: true 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Turnstile verification required',
          requiresTurnstile: true 
        });
      }
    }
    
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (doc.type !== "file") {
      return res.status(400).json({ message: "Cannot download this item type" });
    }

    const userId = req.user ? String(req.user.id) : null;
   const accessCheck = await checkFullPathAccess(req.params.id, userId, key, isAdmin, isPremium);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({ 
        message: accessCheck.reason,
        details: accessCheck.lockedItem || accessCheck.privateItem
      });
    }

    const file = bucket.file(doc.gcsPath);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 30 * 60 * 1000
    });

    if (key) {
      const link = doc.privateAccessLinks.find(l => l.linkId === key);
      if (link && link.isActive) {
        link.accessCount += 1;
        await doc.save();
      }
    }

    res.json({ downloadUrl: url, filename: doc.originalName });

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/search", optionalAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const { 
      q, 
      parentId,  
      limit = 10,
      key
    } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Query missing" });
    }

    const userIdString = req.user ? String(req.user.id) : null;
    const isAdmin = req.user?.isAdmin || false;
    const isPremium = req.user?.isPremium || false;
   if (parentId && !isAdmin && !isPremium) {
     const accessCheck = await checkFullPathAccess(parentId, userIdString, key, isAdmin, isPremium);
      
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          message: accessCheck.reason,
          details: accessCheck.lockedItem || accessCheck.privateItem
        });
      }
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
    .select("name originalName type url mimeType size parent embedding rowCount createdAt updatedAt bookmarkEnabled bookmarks accessLevel grantedUsers privateAccessLinks")
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
    .select("name originalName type url mimeType size parent embedding rowCount createdAt updatedAt bookmarkEnabled bookmarks accessLevel grantedUsers privateAccessLinks")
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
    
    const results = await Promise.all(topResults.map(async (item) => {
      const doc = item.doc;
      const accessCheck = await checkFullPathAccess(doc._id, userIdString, key, isAdmin, isPremium);
     
      
      const isBookmarked = userIdString 
        ? doc.bookmarks?.some(b => String(b.userId) === userIdString)
        : false;

      if (!accessCheck.hasAccess) {
        return {
          _id: doc._id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          parent: doc.parent,
          createdAt: doc.createdAt,
          accessLevel: doc.accessLevel,
          hasAccess: false,
          canRequestAccess: true,
          relevanceScore: item.fusedScore,
          accessDeniedReason: accessCheck.reason
        };
      }

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
        hasAccess: true,
        accessLevel: doc.accessLevel,
        relevanceScore: item.fusedScore,
        vectorScore: item.vectorSim,
        textScore: item.textScore
      };
    }));

    const processingTime = Date.now() - startTime;

    res.json({
      results,  
      searchMetadata: {
        query: normalizedQuery,
        totalResults: results.length,
        processingTime: `${processingTime}ms`,
        searchType: 'hybrid_vector_text',
        inFolder: !!parentId,
        isAdmin
      }
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});
// Helper function to calculate text score (keep existing implementation)
function calculateTextScore(doc, query) {
  const queryLower = query.toLowerCase();
  const nameLower = (doc.name || '').toLowerCase();
  const originalNameLower = (doc.originalName || '').toLowerCase();
  
  let score = 0;
  
  if (nameLower === queryLower || originalNameLower === queryLower) {
    score += 10;
  } else if (nameLower.startsWith(queryLower) || originalNameLower.startsWith(queryLower)) {
    score += 5;
  } else if (nameLower.includes(queryLower) || originalNameLower.includes(queryLower)) {
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
router.patch("/api/admin/access/:id/level", authenticateToken, async (req, res) => {
  try {
    const { accessLevel, inheritParentAccess } = req.body;
    
    if (!['public', 'private', 'locked'].includes(accessLevel)) {
      return res.status(400).json({ 
        message: "Invalid access level. Must be: public, private, or locked" 
      });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.accessLevel = accessLevel;
    if (typeof inheritParentAccess === 'boolean') {
      doc.inheritParentAccess = inheritParentAccess;
    }
    
    await doc.save();

    res.json({ 
      message: `Access level set to ${accessLevel}`,
      document: {
        id: doc._id,
        name: doc.name,
        type: doc.type,
        accessLevel: doc.accessLevel,
        inheritParentAccess: doc.inheritParentAccess
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate private access link
router.post("/api/admin/access/:id/generate-link", authenticateToken, async (req, res) => {
  try {
    const { expiryHours, maxAccessCount } = req.body;
    
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.accessLevel !== 'private') {
      return res.status(400).json({ 
        message: "Can only generate links for private documents" 
      });
    }

    const linkId = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiryHours 
      ? new Date(Date.now() + expiryHours * 60 * 60 * 1000)
      : null;

    doc.privateAccessLinks.push({
      linkId,
      expiresAt,
      maxAccessCount: maxAccessCount || null,
      createdBy: req.user.id,
      isActive: true,
      accessCount: 0
    });

    await doc.save();

    const accessUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/access/${doc._id}?key=${linkId}`;

    res.json({ 
      message: "Private access link generated",
      linkId,
      accessUrl,
      expiresAt,
      maxAccessCount
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke private access link
router.delete("/api/admin/access/:id/link/:linkId", authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const link = doc.privateAccessLinks.find(l => l.linkId === req.params.linkId);
    if (!link) return res.status(404).json({ message: "Link not found" });

    link.isActive = false;
    await doc.save();

    res.json({ message: "Access link revoked" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Grant access to specific user
router.post("/api/admin/access/:id/grant-user", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const alreadyGranted = doc.grantedUsers.find(
      g => g.userId.toString() === userId
    );

    if (alreadyGranted) {
      return res.status(400).json({ message: "User already has access" });
    }

    doc.grantedUsers.push({
      userId,
      grantedBy: req.user.id,
      grantedAt: new Date()
    });

    await doc.save();

    // Send notification email to user
    const message = `You have been granted access to "${doc.name}".`;
    const response = `
      <p>An administrator has granted you access to the following document:</p>
      <p><strong>Document:</strong> ${doc.name}</p>
      <p><strong>Type:</strong> ${doc.type}</p>
      <p>You can now access this document at: <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/documents/${doc._id}">${process.env.CLIENT_URL || 'http://localhost:3000'}/documents/${doc._id}</a></p>
    `;

    const emailHtml = getReplyEmailTemplate2(user.name, message, response);
    await sendEmail(user.email, 'Access Granted - Document Portal', emailHtml);

    res.json({ 
      message: "Access granted to user",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke user access
router.delete("/api/admin/access/:id/revoke-user/:userId", authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.grantedUsers = doc.grantedUsers.filter(
      g => g.userId.toString() !== req.params.userId
    );

    await doc.save();

    res.json({ message: "User access revoked" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all access requests (admin view)
router.get("/api/admin/access-requests", authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const requests = await AccessRequest.find(query)
      .populate('documentId', 'name type size accessLevel')
      .populate('userId', 'name email')
      .sort({ requestedAt: -1 })
      .limit(parseInt(limit));

    res.json({ 
      requests,
      count: requests.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve access request
router.post("/api/admin/access-requests/:requestId/approve", authenticateToken, async (req, res) => {
  try {
    const { expiryHours, adminResponse } = req.body;
    
    const request = await AccessRequest.findById(req.params.requestId)
      .populate('documentId');
    
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: "Request already processed" });
    }

    const doc = request.documentId;
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Generate private access link
    const linkId = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiryHours 
      ? new Date(Date.now() + expiryHours * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    doc.privateAccessLinks.push({
      linkId,
      expiresAt,
      maxAccessCount: null,
      createdBy: req.user.id,
      isActive: true,
      accessCount: 0
    });

    await doc.save();

    const accessUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/access/${doc._id}?key=${linkId}`;

    // Update request
    request.status = 'approved';
    request.adminResponse = adminResponse || 'Your access request has been approved.';
    request.respondedAt = new Date();
    request.respondedBy = req.user.id;
    request.accessLink = accessUrl;
    request.accessLinkId = linkId;
    request.accessLinkExpiry = expiresAt;
    request.responseEmailSent = true;

    await request.save();

    // Send approval email to user
    const message = `Your access request for "${doc.name}" has been approved!`;
    const response = `
      <p>Good news! Your request to access the following document has been approved:</p>
      <p><strong>Document:</strong> ${doc.name}</p>
      <p><strong>Type:</strong> ${doc.type}</p>
      ${adminResponse ? `<p><strong>Admin Message:</strong> ${adminResponse}</p>` : ''}
      <br>
      <p>Click the link below to access the document:</p>
      <a href="${accessUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2c2c2c; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Access Document</a>
      <p><strong>Link expires:</strong> ${expiresAt.toLocaleString()}</p>
      <p><em>Note: Please save this link as you'll need it to access the document.</em></p>
    `;

    const emailHtml = getReplyEmailTemplate2(request.userName, message, response);
    await sendEmail(request.userEmail, 'Access Request Approved - Document Portal', emailHtml);

    res.json({ 
      message: "Access request approved and email sent",
      request,
      accessUrl
    });

  } catch (err) {
    console.error("Approve request error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reject access request
router.post("/api/admin/access-requests/:requestId/reject", authenticateToken, async (req, res) => {
  try {
    const { adminResponse } = req.body;
    
    const request = await AccessRequest.findById(req.params.requestId)
      .populate('documentId', 'name type');
    
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: "Request already processed" });
    }

    request.status = 'rejected';
    request.adminResponse = adminResponse || 'Your access request has been rejected.';
    request.respondedAt = new Date();
    request.respondedBy = req.user.id;
    request.responseEmailSent = true;

    await request.save();

    // Send rejection email to user
    const message = `Your access request for "${request.documentId.name}" has been reviewed.`;
    const response = `
      <p>We have reviewed your request to access "${request.documentId.name}".</p>
      <p>Unfortunately, we are unable to grant access at this time.</p>
      ${adminResponse ? `<p><strong>Reason:</strong> ${adminResponse}</p>` : ''}
      <p>If you have any questions, please contact the administrator.</p>
    `;

    const emailHtml = getReplyEmailTemplate2(request.userName, message, response);
    await sendEmail(request.userEmail, 'Access Request Update - Document Portal', emailHtml);

    res.json({ 
      message: "Access request rejected and email sent",
      request
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get document access settings
router.get("/api/admin/access/:id/settings", authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('grantedUsers.userId', 'name email')
      .populate('grantedUsers.grantedBy', 'name email')
      .populate('privateAccessLinks.createdBy', 'name email');
    
    if (!doc) return res.status(404).json({ message: "Document not found" });

    res.json({
      document: {
        id: doc._id,
        name: doc.name,
        type: doc.type,
        accessLevel: doc.accessLevel,
        inheritParentAccess: doc.inheritParentAccess
      },
      grantedUsers: doc.grantedUsers,
      privateAccessLinks: doc.privateAccessLinks.map(link => ({
        linkId: link.linkId,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        accessCount: link.accessCount,
        maxAccessCount: link.maxAccessCount,
        isActive: link.isActive,
        createdBy: link.createdBy,
        accessUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/access/${doc._id}?key=${link.linkId}`
      }))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== USER ROUTES ====================

// Request access to a document
router.post("/api/user/request-access/:id", async (req, res) => {
  try {
    const { name, email, message, userId } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        message: "Name, email, and message are required" 
      });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.accessLevel === 'public') {
      return res.status(400).json({ 
        message: "This document is already public" 
      });
    }

    // Check for duplicate pending requests
    const existingRequest = await AccessRequest.findOne({
      documentId: doc._id,
      userEmail: email,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ 
        message: "You already have a pending request for this document" 
      });
    }

    // Create access request
    const request = await AccessRequest.create({
      documentId: doc._id,
      userName: name,
      userEmail: email,
      userId: userId || null,
      requestMessage: message,
      requestedAt: new Date(),
      status: 'pending'
    });

    const adminMessage = `New access request received for document: ${doc.name}`;
    const adminResponse = `
      <h3>Access Request Details</h3>
      <p><strong>Document:</strong> ${doc.name}</p>
      <p><strong>Type:</strong> ${doc.type}</p>
      <p><strong>Requested by:</strong> ${name} (${email})</p>
      <p><strong>Message:</strong></p>
      <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</p>
      <br>
      <p>To review and respond to this request, please log in to your admin dashboard:</p>
      <a href="${process.env.CLIENT_URL || 'connectwithaaditiyaadmin.onrender.com'}/admin/access-requests" style="display: inline-block; padding: 12px 24px; background-color: #2c2c2c; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">View Access Requests</a>
      <p><strong>Request ID:</strong> ${request._id}</p>
    `;

    const adminEmailHtml = getReplyEmailTemplate2('Admin', adminMessage, adminResponse);
    await sendEmail(ADMIN_EMAIL, 'New Access Request - Document Portal', adminEmailHtml);

  
    const userMessage = `Your access request for "${doc.name}" has been submitted.`;
    const userResponse = `
      <p>Thank you for your interest in accessing "${doc.name}".</p>
      <p>Your request has been forwarded to the administrator and is currently pending review.</p>
      <p><strong>Your Message:</strong></p>
      <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</p>
      <p>You will receive an email notification once your request has been reviewed.</p>
      <p><strong>Request ID:</strong> ${request._id}</p>
    `;

    const userEmailHtml = getReplyEmailTemplate2(name, userMessage, userResponse);
    await sendEmail(email, 'Access Request Submitted - Document Portal', userEmailHtml);

    request.requestEmailSent = true;
    await request.save();

    res.json({ 
      message: "Access request submitted successfully",
      requestId: request._id
    });

  } catch (err) {
    console.error("Request access error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/api/user/my-access-requests", async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const requests = await AccessRequest.find({ userEmail: email })
      .populate('documentId', 'name type size')
      .sort({ requestedAt: -1 });

    res.json({ 
      requests,
      count: requests.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/user/check-access/:id", async (req, res) => {
  try {
    const { linkId, userId } = req.query;
    
    const doc = await Document.findById(req.params.id)
      .select('name type size accessLevel inheritParentAccess');
    
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const accessCheck = await checkFullPathAccess(req.params.id, userId, linkId);

    res.json({
      hasAccess: accessCheck.hasAccess,
      reason: accessCheck.reason,
      accessLevel: doc.accessLevel,
      documentInfo: {
        name: doc.name,
        type: doc.type,
        size: doc.size
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/user/access-via-link/:id", async (req, res) => {
  try {
    const { linkId } = req.body;
    
    if (!linkId) {
      return res.status(400).json({ message: "Link ID required" });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const accessCheck = await checkFullPathAccess(req.params.id, null, linkId);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({
        message: accessCheck.reason,
        details: accessCheck.lockedItem || accessCheck.privateItem
      });
    }

    const link = doc.privateAccessLinks.find(l => l.linkId === linkId);
    if (link && link.isActive) {
      link.accessCount += 1;
      await doc.save();
    }

    res.json({ 
      message: "Access granted",
      accessCount: link ? link.accessCount : 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;