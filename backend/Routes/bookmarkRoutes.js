const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Bookmark = require('../models/bookmark');
const Blog = require('../models/blog');
const authenticateUser = require('../middlewares/authenticateUser');

const validateBlogId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.blogId)) {
    return res.status(400).json({ message: 'Invalid blog id' });
  }
  next();
};

router.get('/api/bookmarks/ids', authenticateUser, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ user: req.user.user_id }).select('blog').lean();
    res.json({ ids: bookmarks.map(b => b.blog.toString()) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/bookmarks', authenticateUser, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ user: req.user.user_id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({
        path: 'blog',
        match: { status: 'published' },
        select: 'title summary slug featuredImage author publishedAt tags readTime isSubscriberOnly totalReads reactionCounts commentsCount',
        populate: { path: 'author', select: 'name' }
      })
      .lean();

    const blogs = bookmarks
      .filter(b => b.blog)
      .map(b => ({ ...b.blog, bookmarkedAt: b.createdAt }));

    res.json({ blogs, total: blogs.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/bookmarks/:blogId/status', authenticateUser, validateBlogId, async (req, res) => {
  try {
    const exists = await Bookmark.exists({ user: req.user.user_id, blog: req.params.blogId });
    res.json({ bookmarked: !!exists });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/api/bookmarks/:blogId', authenticateUser, validateBlogId, async (req, res) => {
  try {
    const blogExists = await Blog.exists({ _id: req.params.blogId });
    if (!blogExists) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    await Bookmark.updateOne(
      { user: req.user.user_id, blog: req.params.blogId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    res.status(201).json({ message: 'Bookmarked', bookmarked: true });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ message: 'Bookmarked', bookmarked: true });
    }
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/bookmarks/:blogId', authenticateUser, validateBlogId, async (req, res) => {
  try {
    await Bookmark.deleteOne({ user: req.user.user_id, blog: req.params.blogId });
    res.json({ message: 'Bookmark removed', bookmarked: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;