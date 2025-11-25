const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middlewares/authMiddleware');
const Quote = require('../models/quoteSchema');

router.post(
  '/api/quote',
  authenticateToken,
  [
    body('content').trim().notEmpty().withMessage('Quote content is required')
      .isLength({ max: 500 }).withMessage('Quote cannot exceed 500 characters'),
    body('author').optional().trim().isLength({ max: 100 })
      .withMessage('Author name cannot exceed 100 characters')
  ],
  async (req, res) => {
    try {
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content, author } = req.body;

      
      await Quote.deleteMany({});
      
      const newQuote = new Quote({
        content,
        author: author || 'Aaditiya Tyagi',
        addedBy: {
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        }
      });

      await newQuote.save();

      res.status(201).json({
        message: 'Quote updated successfully',
        quote: newQuote
      });

    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.get('/api/quote', async (req, res) => {
  try {
    const quote = await Quote.findOne({ isActive: true })
      .select('-addedBy'); 

    if (!quote) {
      return res.status(404).json({ message: 'No quote found' });
    }

    res.json({
      message: 'Quote retrieved successfully',
      quote
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/api/admin/quote', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findOne();

    if (!quote) {
      return res.status(404).json({ message: 'No quote found' });
    }

    res.json({
      message: 'Quote retrieved successfully',
      quote
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.put(
  '/api/quote',
  authenticateToken,
  [
    body('content').optional().trim().notEmpty().withMessage('Quote content cannot be empty')
      .isLength({ max: 500 }).withMessage('Quote cannot exceed 500 characters'),
    body('author').optional().trim().isLength({ max: 100 })
      .withMessage('Author name cannot exceed 100 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  async (req, res) => {
    try {
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = { ...req.body, updatedAt: Date.now() };

      const updatedQuote = await Quote.findOneAndUpdate(
        {},
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedQuote) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      res.json({
        message: 'Quote updated successfully',
        quote: updatedQuote
      });

    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.delete('/api/quote', authenticateToken, async (req, res) => {
  try {
    const deletedQuote = await Quote.findOneAndDelete({});
    
    if (!deletedQuote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json({
      message: 'Quote deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.patch('/api/quote/toggle', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findOne();
    
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    quote.isActive = !quote.isActive;
    quote.updatedAt = Date.now();
    await quote.save();

    res.json({
      message: `Quote ${quote.isActive ? 'activated' : 'deactivated'} successfully`,
      quote
    });

  } catch (error) {
    console.error('Error toggling quote status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
module.exports = router;