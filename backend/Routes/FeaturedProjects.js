const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middlewares/authMiddleware');
const Project = require('../models/Projects');


router.post(
  '/api/projects',
  authenticateToken,
  [
    body('title').trim().notEmpty().withMessage('Project title is required')
      .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('period').trim().notEmpty().withMessage('Period is required')
      .isLength({ max: 100 }).withMessage('Period cannot exceed 100 characters'),
    body('teamSize').isInt({ min: 1 }).withMessage('Team size must be at least 1'),
    body('description').trim().notEmpty().withMessage('Description is required')
      .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('detailedDescription').isArray().withMessage('Detailed description must be an array'),
    body('detailedDescription.*').trim().isLength({ max: 500 })
      .withMessage('Each detailed description point cannot exceed 500 characters'),
    body('tech').isArray().withMessage('Tech stack must be an array'),
    body('tech.*').trim().isLength({ max: 50 })
      .withMessage('Each tech item cannot exceed 50 characters'),
    body('outcomes').isArray().withMessage('Outcomes must be an array'),
    body('outcomes.*').trim().isLength({ max: 500 })
      .withMessage('Each outcome cannot exceed 500 characters'),
    body('link').optional().trim().isLength({ max: 500 })
      .withMessage('Link cannot exceed 500 characters'),
    body('githubUrl').optional().trim().isLength({ max: 500 })
      .withMessage('GitHub URL cannot exceed 500 characters'),
    body('color').optional().trim().isLength({ max: 50 })
      .withMessage('Color cannot exceed 50 characters'),
    body('imageUrl').trim().notEmpty().withMessage('Image URL is required')
      .isLength({ max: 500 }).withMessage('Image URL cannot exceed 500 characters'),
    body('galleryImages').optional().isArray().withMessage('Gallery images must be an array'),
    body('galleryImages.*').optional().trim().isLength({ max: 500 })
      .withMessage('Each gallery image URL cannot exceed 500 characters'),
    body('order').optional().isInt().withMessage('Order must be a number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        title, 
        period, 
        teamSize, 
        description, 
        detailedDescription, 
        tech, 
        outcomes, 
        link, 
        githubUrl, 
        color, 
        imageUrl, 
        galleryImages,
        order 
      } = req.body;

      const newProject = new Project({
        title,
        period,
        teamSize,
        description,
        detailedDescription,
        tech,
        outcomes,
        link,
        githubUrl,
        color,
        imageUrl,
        galleryImages: galleryImages || [],
        order: order || 0,
        addedBy: {
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        }
      });

      await newProject.save();

      res.status(201).json({
        message: 'Project created successfully',
        project: newProject
      });

    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find({ isActive: true })
      .select('-addedBy')
      .sort({ order: 1, createdAt: -1 });

    res.json({
      message: 'Projects retrieved successfully',
      projects
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .select('-addedBy');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project retrieved successfully',
      project
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/api/admin/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ order: 1, createdAt: -1 });

    res.json({
      message: 'Projects retrieved successfully',
      projects
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/api/admin/projects/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project retrieved successfully',
      project
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.put(
  '/api/projects/:id',
  authenticateToken,
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty')
      .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('period').optional().trim().notEmpty().withMessage('Period cannot be empty')
      .isLength({ max: 100 }).withMessage('Period cannot exceed 100 characters'),
    body('teamSize').optional().isInt({ min: 1 }).withMessage('Team size must be at least 1'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty')
      .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('detailedDescription').optional().isArray().withMessage('Detailed description must be an array'),
    body('detailedDescription.*').optional().trim().isLength({ max: 500 })
      .withMessage('Each detailed description point cannot exceed 500 characters'),
    body('tech').optional().isArray().withMessage('Tech stack must be an array'),
    body('tech.*').optional().trim().isLength({ max: 50 })
      .withMessage('Each tech item cannot exceed 50 characters'),
    body('outcomes').optional().isArray().withMessage('Outcomes must be an array'),
    body('outcomes.*').optional().trim().isLength({ max: 500 })
      .withMessage('Each outcome cannot exceed 500 characters'),
    body('link').optional().trim().isLength({ max: 500 })
      .withMessage('Link cannot exceed 500 characters'),
    body('githubUrl').optional().trim().isLength({ max: 500 })
      .withMessage('GitHub URL cannot exceed 500 characters'),
    body('color').optional().trim().isLength({ max: 50 })
      .withMessage('Color cannot exceed 50 characters'),
    body('imageUrl').optional().trim().notEmpty().withMessage('Image URL cannot be empty')
      .isLength({ max: 500 }).withMessage('Image URL cannot exceed 500 characters'),
    body('galleryImages').optional().isArray().withMessage('Gallery images must be an array'),
    body('galleryImages.*').optional().trim().isLength({ max: 500 })
      .withMessage('Each gallery image URL cannot exceed 500 characters'),
    body('order').optional().isInt().withMessage('Order must be a number'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = { ...req.body, updatedAt: Date.now() };

      const updatedProject = await Project.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedProject) {
        return res.status(404).json({ message: 'Project not found' });
      }

      res.json({
        message: 'Project updated successfully',
        project: updatedProject
      });

    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.patch('/api/projects/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.isActive = !project.isActive;
    project.updatedAt = Date.now();
    await project.save();

    res.json({
      message: `Project ${project.isActive ? 'activated' : 'deactivated'} successfully`,
      project
    });

  } catch (error) {
    console.error('Error toggling project status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.patch(
  '/api/projects/:id/gallery/add',
  authenticateToken,
  [
    body('imageUrl').trim().notEmpty().withMessage('Image URL is required')
      .isLength({ max: 500 }).withMessage('Image URL cannot exceed 500 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { imageUrl } = req.body;
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      
      if (!project.galleryImages) {
        project.galleryImages = [];
      }

      
      if (project.galleryImages.includes(imageUrl)) {
        return res.status(400).json({ message: 'Image already exists in gallery' });
      }

      project.galleryImages.push(imageUrl);
      project.updatedAt = Date.now();
      await project.save();

      res.json({
        message: 'Image added to gallery successfully',
        project
      });

    } catch (error) {
      console.error('Error adding gallery image:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.patch(
  '/api/projects/:id/gallery/remove',
  authenticateToken,
  [
    body('imageUrl').trim().notEmpty().withMessage('Image URL is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { imageUrl } = req.body;
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (!project.galleryImages || project.galleryImages.length === 0) {
        return res.status(400).json({ message: 'Gallery is empty' });
      }

      const imageIndex = project.galleryImages.indexOf(imageUrl);
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found in gallery' });
      }

      project.galleryImages.splice(imageIndex, 1);
      project.updatedAt = Date.now();
      await project.save();

      res.json({
        message: 'Image removed from gallery successfully',
        project
      });

    } catch (error) {
      console.error('Error removing gallery image:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.patch(
  '/api/projects/:id/image',
  authenticateToken,
  [
    body('imageUrl').trim().notEmpty().withMessage('Image URL is required')
      .isLength({ max: 500 }).withMessage('Image URL cannot exceed 500 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { imageUrl } = req.body;
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      project.imageUrl = imageUrl;
      project.updatedAt = Date.now();
      await project.save();

      res.json({
        message: 'Main image updated successfully',
        project
      });

    } catch (error) {
      console.error('Error updating main image:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;