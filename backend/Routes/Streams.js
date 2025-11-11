const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Stream = require('../models/streamSchema');
const extractYouTubeId = require('../utils/extractYouTubeId');
router.post('/api/admin/streams', authenticateToken, async (req, res) => {
  try {
    const { title, description, scheduledDate, scheduledTime, youtubeLink, password } = req.body;
    
    const embedId = extractYouTubeId(youtubeLink);
    if (!embedId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const stream = new Stream({
      title,
      description,
      scheduledDate,
      scheduledTime,
      youtubeLink,
      embedId,
      password: password || null
    });

    await stream.save();
    res.status(201).json({ message: 'Stream scheduled successfully', stream });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update stream
router.put('/api/admin/streams/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, scheduledDate, scheduledTime, youtubeLink, status, password } = req.body;
    
    const updateData = { title, description, scheduledDate, scheduledTime, status };
    
    // Handle password update (can be set, updated, or removed)
    if (password !== undefined) {
      updateData.password = password || null;
    }
    
    if (youtubeLink) {
      const embedId = extractYouTubeId(youtubeLink);
      if (!embedId) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }
      updateData.youtubeLink = youtubeLink;
      updateData.embedId = embedId;
    }

    const stream = await Stream.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json({ message: 'Stream updated successfully', stream });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete stream
router.delete('/api/admin/streams/:id', authenticateToken, async (req, res) => {
  try {
    const stream = await Stream.findByIdAndDelete(req.params.id);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    res.json({ message: 'Stream deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all streams for admin
router.get('/api/admin/streams', authenticateToken, async (req, res) => {
  try {
    const streams = await Stream.find().sort({ scheduledDate: 1, scheduledTime: 1 });
    res.json({ streams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC ROUTES

// Get all upcoming streams (password-protected streams show limited info)
router.get('/api/streams', async (req, res) => {
  try {
    const streams = await Stream.find()
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .select('-__v');
    
    // Filter out sensitive data for password-protected streams
    const filteredStreams = streams.map(stream => {
      if (stream.password) {
        return {
          _id: stream._id,
          title: stream.title,
          description: stream.description,
          scheduledDate: stream.scheduledDate,
          scheduledTime: stream.scheduledTime,
          status: stream.status,
          createdAt: stream.createdAt,
          isPasswordProtected: true
        };
      }
      return {
        ...stream.toObject(),
        isPasswordProtected: false
      };
    });
    
    res.json({ streams: filteredStreams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single stream by ID (requires password if protected)
router.post('/api/streams/:id', async (req, res) => {
  try {
    const { password } = req.body;
    const stream = await Stream.findById(req.params.id).select('-__v');
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Check if stream is password protected
    if (stream.password) {
      if (!password) {
        return res.status(401).json({ 
          error: 'Password required',
          message: 'This stream is password protected. Please provide the password.',
          isPasswordProtected: true
        });
      }
      
      if (password !== stream.password) {
        return res.status(401).json({ 
          error: 'Invalid password',
          message: 'The password you entered is incorrect.',
          isPasswordProtected: true
        });
      }
    }

    // Return full stream data (excluding password from response)
    const streamData = stream.toObject();
    delete streamData.password;
    
    res.json({ 
      stream: {
        ...streamData,
        isPasswordProtected: !!stream.password
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get streams by date
router.get('/api/streams/date/:date', async (req, res) => {
  try {
    const streams = await Stream.find({ 
      scheduledDate: req.params.date,
      status: { $in: ['scheduled', 'live'] }
    }).sort({ scheduledTime: 1 }).select('-__v');
    
    // Filter out sensitive data for password-protected streams
    const filteredStreams = streams.map(stream => {
      if (stream.password) {
        return {
          _id: stream._id,
          title: stream.title,
          description: stream.description,
          scheduledDate: stream.scheduledDate,
          scheduledTime: stream.scheduledTime,
          status: stream.status,
          createdAt: stream.createdAt,
          isPasswordProtected: true
        };
      }
      return {
        ...stream.toObject(),
        isPasswordProtected: false
      };
    });
    
    res.json({ streams: filteredStreams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get live streams
router.get('/api/streams/live', async (req, res) => {
  try {
    const streams = await Stream.find({ status: 'live' })
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .select('-__v');
    
    // Filter out sensitive data for password-protected streams
    const filteredStreams = streams.map(stream => {
      if (stream.password) {
        return {
          _id: stream._id,
          title: stream.title,
          description: stream.description,
          scheduledDate: stream.scheduledDate,
          scheduledTime: stream.scheduledTime,
          status: stream.status,
          createdAt: stream.createdAt,
          isPasswordProtected: true
        };
      }
      return {
        ...stream.toObject(),
        isPasswordProtected: false
      };
    });
    
    res.json({ streams: filteredStreams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get embed data for stream (requires password if protected)
router.post('/api/streams/:id/embed', async (req, res) => {
  try {
    const { password } = req.body;
    const stream = await Stream.findById(req.params.id).select('title embedId youtubeLink password');
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Check if stream is password protected
    if (stream.password) {
      if (!password) {
        return res.status(401).json({ 
          error: 'Password required',
          message: 'This stream is password protected. Please provide the password.',
          isPasswordProtected: true
        });
      }
      
      if (password !== stream.password) {
        return res.status(401).json({ 
          error: 'Invalid password',
          message: 'The password you entered is incorrect.',
          isPasswordProtected: true
        });
      }
    }

    res.json({ 
      embedId: stream.embedId,
      embedUrl: `https://www.youtube.com/embed/${stream.embedId}`,
      title: stream.title,
      youtubeLink: stream.youtubeLink,
      isPasswordProtected: !!stream.password
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.use('/api/youtube-chat-proxy', createProxyMiddleware({
  target: 'https://www.youtube.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/youtube-chat-proxy': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // Remove X-Frame-Options header
    proxyReq.removeHeader('X-Frame-Options');
    proxyReq.removeHeader('Content-Security-Policy');
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Remove headers that prevent iframe embedding
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-content-type-options'];
    
    // Set headers to allow embedding
    proxyRes.headers['X-Frame-Options'] = 'ALLOWALL';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Headers'] = '*';
  },
  logLevel: 'debug'
}));

// Alternative: Custom chat endpoint that fetches YouTube chat data
router.get('/api/streams/:id/chat', async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // For now, return a placeholder response
    // In production, you'd need to implement YouTube Data API integration
    res.json({
      chatAvailable: stream.status === 'live',
      embedId: stream.embedId,
      proxyUrl: `/api/youtube-chat-proxy/live_chat?v=${stream.embedId}&embed_domain=${req.headers.host}`,
      status: stream.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;