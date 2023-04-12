const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const Content = mongoose.model('Content');

router.post('/addContent', requireAuth, async (req, res) => {
    const { text, prompt, category, savedBy } = req.body;
    const newContent = new Content({ text, prompt, category, savedBy });

    try {
        const savedContent = await newContent.save();
        res.status(201).json(savedContent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.patch('/updateContent/:id', requireAdmin, async (req, res) => {
    const userId = req.user._id;
    const { text, prompt, title } = req.body;
    const updateFields = {};

    if (text !== undefined) {
        updateFields.text = text;
    }
    if (prompt !== undefined) {
        updateFields.prompt = prompt;
    }
    if (title !== undefined) {
        updateFields.title = title;
    }

    try {
        const content = await Content.findOne({ _id: req.params.id, savedBy: userId });

        if (!content) {
            res.status(403).json({ message: 'Forbidden: You do not have permission to update this content' });
        } else {
            const updatedContent = await Content.findByIdAndUpdate(req.params.id, updateFields, { new: true });
            res.status(200).json(updatedContent);
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


router.delete('/deleteContent/:id', requireAdmin, async (req, res) => {
    const contentId = req.params.id;

    try {
        const content = await Content.findById(contentId);
        if (!content) {
            res.status(404).json({ message: 'Content not found' });
        } else {
            await content.remove();
            res.status(200).json({ message: 'Content deleted successfully' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/getSavedContent', requireAdmin, async (req, res) => {
    try {
      const contents = await Content.find();
      res.status(200).json(contents);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  
  router.get('/getSavedContent/:userId', requireAuth, async (req, res) => {
    try {
      const contents = await Content.find({ savedBy: req.user._id });
      res.status(200).json(contents);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  

module.exports = router;