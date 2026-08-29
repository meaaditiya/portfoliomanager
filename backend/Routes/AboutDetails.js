const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middlewares/authMiddleware');
const cloudinaryUpload = require('../middlewares/cloudinaryUpload');
const cloudinaryUploadDocument = require('../middlewares/cloudinaryUploadDocument');
const cloudinary = require('../Config/cloudinarystorage');
const AboutDetails = require('../models/AboutDetails');

const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

const getOrCreateAboutDoc = async () => {
  let doc = await AboutDetails.findOne();
  if (!doc) {
    doc = new AboutDetails({});
    await doc.save();
  }
  return doc;
};

// ============ PUBLIC ============

router.get('/api/about', async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    res.json({ about: doc });
  } catch (error) {
    console.error('Error fetching about details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ ADMIN: base fields ============

router.get('/api/admin/about', authenticateToken, async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    res.json({ about: doc });
  } catch (error) {
    console.error('Error fetching about details (admin):', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put(
  '/api/admin/about',
  authenticateToken,
  [
    body('heroTitlePrefix').optional().trim().isLength({ max: 50 }),
    body('heroTitleHighlight').optional().trim().isLength({ max: 50 }),
    body('summaryPoints').optional().isArray(),
    body('jobStatuses').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await getOrCreateAboutDoc();
      const { heroTitlePrefix, heroTitleHighlight, summaryPoints, jobStatuses } = req.body;

      if (heroTitlePrefix !== undefined) doc.heroTitlePrefix = heroTitlePrefix;
      if (heroTitleHighlight !== undefined) doc.heroTitleHighlight = heroTitleHighlight;
      if (summaryPoints !== undefined) doc.summaryPoints = summaryPoints;
      if (jobStatuses !== undefined) {
        doc.jobStatuses = jobStatuses.map((status, index) => ({
          label: status.label,
          color: status.color || '#22c55e',
          order: status.order ?? index
        }));
      }

      await doc.save();
      res.json({ message: 'About details updated successfully', about: doc });
    } catch (error) {
      console.error('Error updating about details:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ============ ADMIN: resume ============

router.post(
  '/api/admin/about/resume',
  authenticateToken,
  cloudinaryUploadDocument.single('resume'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Resume PDF file is required' });
      }
      const doc = await getOrCreateAboutDoc();

      if (doc.resume?.publicId) {
        await deleteCloudinaryAsset(doc.resume.publicId, 'raw');
      }

      doc.resume = {
        url: req.file.path,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        uploadedAt: new Date()
      };
      await doc.save();

      res.json({ message: 'Resume uploaded successfully', resume: doc.resume });
    } catch (error) {
      console.error('Error uploading resume:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/about/resume', authenticateToken, async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    if (doc.resume?.publicId) {
      await deleteCloudinaryAsset(doc.resume.publicId, 'raw');
    }
    doc.resume = undefined;
    await doc.save();
    res.json({ message: 'Resume removed successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ ADMIN: skills ============

router.post(
  '/api/admin/about/skills',
  authenticateToken,
  cloudinaryUpload.single('logo'),
  [body('name').trim().notEmpty().withMessage('Skill name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await getOrCreateAboutDoc();
      const skill = { name: req.body.name, order: doc.skills.length };
      if (req.file) {
        skill.logo = { url: req.file.path, publicId: req.file.filename };
      }
      doc.skills.push(skill);
      await doc.save();
      res.status(201).json({ message: 'Skill added successfully', about: doc });
    } catch (error) {
      console.error('Error adding skill:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put(
  '/api/admin/about/skills/:skillId',
  authenticateToken,
  cloudinaryUpload.single('logo'),
  async (req, res) => {
    try {
      const doc = await getOrCreateAboutDoc();
      const skill = doc.skills.id(req.params.skillId);
      if (!skill) return res.status(404).json({ message: 'Skill not found' });

      if (req.body.name !== undefined) skill.name = req.body.name;
      if (req.body.order !== undefined) skill.order = req.body.order;

      if (req.file) {
        if (skill.logo?.publicId) await deleteCloudinaryAsset(skill.logo.publicId);
        skill.logo = { url: req.file.path, publicId: req.file.filename };
      }

      await doc.save();
      res.json({ message: 'Skill updated successfully', about: doc });
    } catch (error) {
      console.error('Error updating skill:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/about/skills/:skillId', authenticateToken, async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    const skill = doc.skills.id(req.params.skillId);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });

    if (skill.logo?.publicId) await deleteCloudinaryAsset(skill.logo.publicId);
    skill.deleteOne();
    await doc.save();
    res.json({ message: 'Skill deleted successfully', about: doc });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ ADMIN: experience ============

router.post(
  '/api/admin/about/experience',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  [
    body('role').trim().notEmpty().withMessage('Role is required'),
    body('company').trim().notEmpty().withMessage('Company is required'),
    body('startDate').trim().notEmpty().withMessage('Start date is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await getOrCreateAboutDoc();
      const exp = {
        role: req.body.role,
        company: req.body.company,
        startDate: req.body.startDate,
        endDate: req.body.endDate || 'Present',
        order: doc.experience.length
      };
      if (req.file) {
        exp.companyLogo = { url: req.file.path, publicId: req.file.filename };
      }
      doc.experience.push(exp);
      await doc.save();
      res.status(201).json({ message: 'Experience added successfully', about: doc });
    } catch (error) {
      console.error('Error adding experience:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put(
  '/api/admin/about/experience/:expId',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  async (req, res) => {
    try {
      const doc = await getOrCreateAboutDoc();
      const exp = doc.experience.id(req.params.expId);
      if (!exp) return res.status(404).json({ message: 'Experience not found' });

      ['role', 'company', 'startDate', 'endDate', 'order'].forEach((field) => {
        if (req.body[field] !== undefined) exp[field] = req.body[field];
      });

      if (req.file) {
        if (exp.companyLogo?.publicId) await deleteCloudinaryAsset(exp.companyLogo.publicId);
        exp.companyLogo = { url: req.file.path, publicId: req.file.filename };
      }

      await doc.save();
      res.json({ message: 'Experience updated successfully', about: doc });
    } catch (error) {
      console.error('Error updating experience:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/about/experience/:expId', authenticateToken, async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    const exp = doc.experience.id(req.params.expId);
    if (!exp) return res.status(404).json({ message: 'Experience not found' });

    if (exp.companyLogo?.publicId) await deleteCloudinaryAsset(exp.companyLogo.publicId);
    exp.deleteOne();
    await doc.save();
    res.json({ message: 'Experience deleted successfully', about: doc });
  } catch (error) {
    console.error('Error deleting experience:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ ADMIN: education ============

router.post(
  '/api/admin/about/education',
  authenticateToken,
  cloudinaryUpload.single('schoolLogo'),
  [
    body('degree').trim().notEmpty().withMessage('Degree is required'),
    body('school').trim().notEmpty().withMessage('School is required'),
    body('duration').trim().notEmpty().withMessage('Duration is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await getOrCreateAboutDoc();
      const edu = {
        degree: req.body.degree,
        school: req.body.school,
        duration: req.body.duration,
        grade: req.body.grade || '',
        order: doc.education.length
      };
      if (req.file) {
        edu.schoolLogo = { url: req.file.path, publicId: req.file.filename };
      }
      doc.education.push(edu);
      await doc.save();
      res.status(201).json({ message: 'Education added successfully', about: doc });
    } catch (error) {
      console.error('Error adding education:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.put(
  '/api/admin/about/education/:eduId',
  authenticateToken,
  cloudinaryUpload.single('schoolLogo'),
  async (req, res) => {
    try {
      const doc = await getOrCreateAboutDoc();
      const edu = doc.education.id(req.params.eduId);
      if (!edu) return res.status(404).json({ message: 'Education not found' });

      ['degree', 'school', 'duration', 'grade', 'order'].forEach((field) => {
        if (req.body[field] !== undefined) edu[field] = req.body[field];
      });

      if (req.file) {
        if (edu.schoolLogo?.publicId) await deleteCloudinaryAsset(edu.schoolLogo.publicId);
        edu.schoolLogo = { url: req.file.path, publicId: req.file.filename };
      }

      await doc.save();
      res.json({ message: 'Education updated successfully', about: doc });
    } catch (error) {
      console.error('Error updating education:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/about/education/:eduId', authenticateToken, async (req, res) => {
  try {
    const doc = await getOrCreateAboutDoc();
    const edu = doc.education.id(req.params.eduId);
    if (!edu) return res.status(404).json({ message: 'Education not found' });

    if (edu.schoolLogo?.publicId) await deleteCloudinaryAsset(edu.schoolLogo.publicId);
    edu.deleteOne();
    await doc.save();
    res.json({ message: 'Education deleted successfully', about: doc });
  } catch (error) {
    console.error('Error deleting education:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;