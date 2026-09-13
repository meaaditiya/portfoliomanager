const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const XLSX = require('xlsx');
const authenticateToken = require('../middlewares/authMiddleware');
const cloudinaryUpload = require('../middlewares/cloudinaryUpload');
const cloudinaryUploadDocument = require('../middlewares/cloudinaryUploadDocument');
const cloudinary = require('../Config/cloudinarystorage');
const { ReferralPosting, JobPosting, Application, StatusOption } = require('../models/Referjobschema');

const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

const modelFor = (type) => (type === 'job' ? JobPosting : ReferralPosting);
const modelNameFor = (type) => (type === 'job' ? 'JobPosting' : 'ReferralPosting');

const buildQuestionsFromBody = (rawQuestions) => {
  if (!rawQuestions) return [];
  let parsed = rawQuestions;
  if (typeof rawQuestions === 'string') {
    parsed = JSON.parse(rawQuestions);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((q, index) => ({
    questionText: q.questionText,
    type: q.type || 'text',
    options: Array.isArray(q.options) ? q.options : [],
    placeholder: q.placeholder || '',
    required: !!q.required,
    order: q.order ?? index
  }));
};

const generateUniqueApplicationId = async (type) => {
  let id;
  let exists = true;
  while (exists) {
    id = Application.generateApplicationId(type);
    exists = await Application.exists({ applicationId: id });
  }
  return id;
};

router.get('/api/public/referral-postings', async (req, res) => {
  try {
    const postings = await ReferralPosting.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, postings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/public/referral-postings/:id', async (req, res) => {
  try {
    const posting = await ReferralPosting.findById(req.params.id);
    if (!posting || !posting.isActive) {
      return res.status(404).json({ success: false, message: 'Posting not found' });
    }
    res.json({ success: true, posting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/public/job-postings', async (req, res) => {
  try {
    const postings = await JobPosting.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, postings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/public/job-postings/:id', async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting || !posting.isActive) {
      return res.status(404).json({ success: false, message: 'Posting not found' });
    }
    res.json({ success: true, posting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post(
  '/api/public/applications',
  cloudinaryUploadDocument.single('resume'),
  [
    body('applicationType').isIn(['referral', 'job']).withMessage('Valid application type is required'),
    body('postingId').trim().notEmpty().withMessage('Posting id is required'),
    body('applicantName').trim().notEmpty().withMessage('Name is required'),
    body('applicantEmail').trim().isEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const { applicationType, postingId, applicantName, applicantEmail, applicantPhone } = req.body;
      const PostingModel = modelFor(applicationType);
      const posting = await PostingModel.findById(postingId);

      if (!posting || !posting.isActive) {
        return res.status(404).json({ success: false, message: 'Posting not found or inactive' });
      }

      let rawAnswers = req.body.answers;
      if (typeof rawAnswers === 'string') {
        rawAnswers = JSON.parse(rawAnswers);
      }
      if (!Array.isArray(rawAnswers)) rawAnswers = [];

      const answers = posting.questions.map((question) => {
        const submitted = rawAnswers.find((a) => a.questionId === String(question._id));
        if (question.required && (submitted === undefined || submitted.answer === undefined || submitted.answer === '')) {
          throw new Error(`Answer required for: ${question.questionText}`);
        }
        return {
          questionId: question._id,
          questionText: question.questionText,
          questionType: question.type,
          answer: submitted ? submitted.answer : ''
        };
      });

      const applicationId = await generateUniqueApplicationId(applicationType);

      const application = new Application({
        applicationId,
        applicationType,
        postingModel: modelNameFor(applicationType),
        postingId: posting._id,
        postingSnapshot: {
          companyName: applicationType === 'job' ? posting.company : posting.companyName,
          roleTitle: applicationType === 'job' ? posting.title : posting.roleTitle
        },
        applicantName,
        applicantEmail,
        applicantPhone,
        answers,
        ipAddress: req.ip
      });

      if (req.file) {
        application.resume = {
          url: req.file.path,
          publicId: req.file.filename,
          originalName: req.file.originalname
        };
      }

      await application.save();

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.applicationId
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to submit application' });
    }
  }
);

router.get('/api/public/applications/status/:applicationId', async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.applicationId })
      .select('applicationId applicationType postingSnapshot applicantName currentStatus statusHistory createdAt');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/referral-postings', authenticateToken, async (req, res) => {
  try {
    const postings = await ReferralPosting.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, postings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/referral-postings/:id', authenticateToken, async (req, res) => {
  try {
    const posting = await ReferralPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });
    res.json({ success: true, posting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post(
  '/api/admin/referral-postings',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  [
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
    body('roleTitle').trim().notEmpty().withMessage('Role title is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const posting = new ReferralPosting({
        companyName: req.body.companyName,
        roleTitle: req.body.roleTitle,
        department: req.body.department,
        location: req.body.location,
        jobType: req.body.jobType,
        experienceLevel: req.body.experienceLevel,
        description: req.body.description,
        externalJobLink: req.body.externalJobLink,
        questions: buildQuestionsFromBody(req.body.questions),
        isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
        order: req.body.order || 0
      });

      if (req.file) {
        posting.companyLogo = { url: req.file.path, publicId: req.file.filename };
      }

      await posting.save();
      res.status(201).json({ success: true, message: 'Referral posting created successfully', posting });
    } catch (error) {
      console.error('Error creating referral posting:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.put(
  '/api/admin/referral-postings/:id',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  async (req, res) => {
    try {
      const posting = await ReferralPosting.findById(req.params.id);
      if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });

      const fields = ['companyName', 'roleTitle', 'department', 'location', 'jobType', 'experienceLevel', 'description', 'externalJobLink', 'order'];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) posting[field] = req.body[field];
      });

      if (req.body.isActive !== undefined) {
        posting.isActive = req.body.isActive === 'true' || req.body.isActive === true;
      }

      if (req.body.questions !== undefined) {
        posting.questions = buildQuestionsFromBody(req.body.questions);
      }

      if (req.file) {
        if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
        posting.companyLogo = { url: req.file.path, publicId: req.file.filename };
      } else if (req.body.removeLogo === 'true') {
        if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
        posting.companyLogo = undefined;
      }

      await posting.save();
      res.json({ success: true, message: 'Referral posting updated successfully', posting });
    } catch (error) {
      console.error('Error updating referral posting:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/referral-postings/:id', authenticateToken, async (req, res) => {
  try {
    const posting = await ReferralPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });

    if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
    await posting.deleteOne();
    res.json({ success: true, message: 'Referral posting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/job-postings', authenticateToken, async (req, res) => {
  try {
    const postings = await JobPosting.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, postings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/job-postings/:id', authenticateToken, async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });
    res.json({ success: true, posting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post(
  '/api/admin/job-postings',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('company').trim().notEmpty().withMessage('Company is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const posting = new JobPosting({
        title: req.body.title,
        company: req.body.company,
        location: req.body.location,
        jobType: req.body.jobType,
        experienceLevel: req.body.experienceLevel,
        salaryRange: {
          min: req.body.salaryMin || undefined,
          max: req.body.salaryMax || undefined,
          currency: req.body.currency || 'INR',
          isDisclosed: req.body.isDisclosed === 'true' || req.body.isDisclosed === true
        },
        description: req.body.description,
        applyMode: req.body.applyMode || 'external',
        applyLink: req.body.applyLink,
        questions: buildQuestionsFromBody(req.body.questions),
        isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
        order: req.body.order || 0
      });

      if (req.file) {
        posting.companyLogo = { url: req.file.path, publicId: req.file.filename };
      }

      await posting.save();
      res.status(201).json({ success: true, message: 'Job posting created successfully', posting });
    } catch (error) {
      console.error('Error creating job posting:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.put(
  '/api/admin/job-postings/:id',
  authenticateToken,
  cloudinaryUpload.single('companyLogo'),
  async (req, res) => {
    try {
      const posting = await JobPosting.findById(req.params.id);
      if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });

      const fields = ['title', 'company', 'location', 'jobType', 'experienceLevel', 'description', 'applyMode', 'applyLink', 'order'];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) posting[field] = req.body[field];
      });

      if (req.body.salaryMin !== undefined) posting.salaryRange.min = req.body.salaryMin;
      if (req.body.salaryMax !== undefined) posting.salaryRange.max = req.body.salaryMax;
      if (req.body.currency !== undefined) posting.salaryRange.currency = req.body.currency;
      if (req.body.isDisclosed !== undefined) posting.salaryRange.isDisclosed = req.body.isDisclosed === 'true' || req.body.isDisclosed === true;

      if (req.body.isActive !== undefined) {
        posting.isActive = req.body.isActive === 'true' || req.body.isActive === true;
      }

      if (req.body.questions !== undefined) {
        posting.questions = buildQuestionsFromBody(req.body.questions);
      }

      if (req.file) {
        if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
        posting.companyLogo = { url: req.file.path, publicId: req.file.filename };
      } else if (req.body.removeLogo === 'true') {
        if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
        posting.companyLogo = undefined;
      }

      await posting.save();
      res.json({ success: true, message: 'Job posting updated successfully', posting });
    } catch (error) {
      console.error('Error updating job posting:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/job-postings/:id', authenticateToken, async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ success: false, message: 'Posting not found' });

    if (posting.companyLogo?.publicId) await deleteCloudinaryAsset(posting.companyLogo.publicId);
    await posting.deleteOne();
    res.json({ success: true, message: 'Job posting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/status-options', authenticateToken, async (req, res) => {
  try {
    const options = await StatusOption.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, options });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post(
  '/api/admin/status-options',
  authenticateToken,
  [body('label').trim().notEmpty().withMessage('Label is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const option = new StatusOption({
        label: req.body.label,
        color: req.body.color || '#6b7280',
        appliesTo: req.body.appliesTo || 'both',
        order: req.body.order || 0
      });
      await option.save();
      res.status(201).json({ success: true, message: 'Status option created successfully', option });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.put('/api/admin/status-options/:id', authenticateToken, async (req, res) => {
  try {
    const option = await StatusOption.findById(req.params.id);
    if (!option) return res.status(404).json({ success: false, message: 'Status option not found' });

    ['label', 'color', 'appliesTo', 'order'].forEach((field) => {
      if (req.body[field] !== undefined) option[field] = req.body[field];
    });

    await option.save();
    res.json({ success: true, message: 'Status option updated successfully', option });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.delete('/api/admin/status-options/:id', authenticateToken, async (req, res) => {
  try {
    const option = await StatusOption.findByIdAndDelete(req.params.id);
    if (!option) return res.status(404).json({ success: false, message: 'Status option not found' });
    res.json({ success: true, message: 'Status option deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/applications', authenticateToken, async (req, res) => {
  try {
    const { applicationType, postingId, statusLabel, search, page, limit } = req.query;
    const filter = {};

    if (applicationType) filter.applicationType = applicationType;
    if (postingId) filter.postingId = postingId;
    if (statusLabel) filter['currentStatus.label'] = statusLabel;
    if (search) {
      filter.$or = [
        { applicantName: { $regex: search, $options: 'i' } },
        { applicantEmail: { $regex: search, $options: 'i' } },
        { applicationId: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Application.countDocuments(filter);

    res.json({
      success: true,
      applications,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/applications/export', authenticateToken, async (req, res) => {
  try {
    const { applicationType, postingId, statusLabel } = req.query;
    const filter = {};

    if (applicationType) filter.applicationType = applicationType;
    if (postingId) filter.postingId = postingId;
    if (statusLabel) filter['currentStatus.label'] = statusLabel;

    const applications = await Application.find(filter).sort({ createdAt: -1 });

    const rows = applications.map((app) => {
      const base = {
        'Application ID': app.applicationId,
        'Type': app.applicationType,
        'Company': app.postingSnapshot?.companyName || '',
        'Role': app.postingSnapshot?.roleTitle || '',
        'Applicant Name': app.applicantName,
        'Email': app.applicantEmail,
        'Phone': app.applicantPhone || '',
        'Resume': app.resume?.url || '',
        'Status': app.currentStatus?.label || '',
        'Status Note': app.currentStatus?.note || '',
        'Submitted At': app.createdAt ? new Date(app.createdAt).toLocaleString() : ''
      };

      app.answers.forEach((answer) => {
        const value = Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer;
        base[answer.questionText] = value;
      });

      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=applications.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting applications:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/api/admin/applications/:id', authenticateToken, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.put(
  '/api/admin/applications/:id/status',
  authenticateToken,
  [body('label').trim().notEmpty().withMessage('Status label is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const application = await Application.findById(req.params.id);
      if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

      application.currentStatus = {
        label: req.body.label,
        color: req.body.color || '#6b7280',
        note: req.body.note || '',
        updatedAt: new Date()
      };
      application._statusUpdatedBy = req.user.email || req.user.id;

      await application.save();
      res.json({ success: true, message: 'Application status updated successfully', application });
    } catch (error) {
      console.error('Error updating application status:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
);

router.delete('/api/admin/applications/:id', authenticateToken, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    if (application.resume?.publicId) await deleteCloudinaryAsset(application.resume.publicId, 'raw');
    await application.deleteOne();
    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;