const express = require('express');
const mongoose = require('mongoose');
const Prompt = mongoose.model('Prompt');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();

router.post('/addPrompt', requireAuth, async (req, res) => {
    const { title, text, hashtags, category } = req.body;
    const author = req.user._id;
  
    try {
      const prompt = new Prompt({
        title,
        text,
        hashtags,
        author,
        category,
      });
  
      await prompt.save();
  
      res.status(201).json({ prompt });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  });

  router.get('/getPrompts', async (req, res) => {
    const { page = 1, limit = 20, category, searchTerm } = req.query;
  
    try {
      let query = category
        ? { category: { $regex: new RegExp(category, 'i') } }
        : {};
  
      if (searchTerm) {
        query = {
          $or: [
            { title: { $regex: new RegExp(searchTerm, 'i') } },
            { text: { $regex: new RegExp(searchTerm, 'i') } },
          ],
          ...query,
        };
      }
  
      const prompts = await Prompt.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      res.json(prompts);
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  });
  
  
router.get('/user/:userId/likedPrompts', (req, res) => {
    const userId = req.params.userId;
  
    Prompt.find({ likes: userId }, (err, prompts) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal server error');
      }
  
      res.json(prompts);
    });
  });

// Liking/Disliking endpoint
router.patch('/prompts/:id/like', requireAuth, async (req, res) => {
    try {
      const prompt = await Prompt.findById(req.params.id);
      if (!prompt) {
        return res.status(404).json({ message: 'Prompt not found' });
      }
  
      const userId = req.user._id;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
  
      // Toggle the like/dislike status based on whether the user has already liked the prompt
      if (prompt.likes.includes(userId)) {
        // User has already liked the prompt, so remove the like
        prompt.likes = prompt.likes.filter((id) => !id.equals(userId));
        await prompt.save();
        res.json({ message: 'Prompt disliked', prompt });
      } else {
        // User has not liked the prompt yet, so add the like
        prompt.likes.push(userId);
        await prompt.save();
        res.json({ message: 'Prompt liked', prompt });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

  router.delete('/prompts/:id', requireAuth, async (req, res) => {
    try {
      const prompt = await Prompt.findByIdAndDelete(req.params.id);
      if (!prompt) {
        return res.status(404).send('Prompt not found');
      }
      res.send('Prompt deleted successfully');
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  });
  

    router.patch('/prompts/:id', requireAuth, async (req, res) => {
    try {
      const prompt = await Prompt.findById(req.params.id);
      if (!prompt) {
        return res.status(404).send('Prompt not found');
      }
      if (prompt.author !== req.user._id.toString()) {
        return res.status(403).send('Unauthorized');
      }
      prompt.title = req.body.title;
      prompt.text = req.body.text;
      prompt.hashtags = req.body.hashtags;
      const updatedPrompt = await prompt.save();
      res.json(updatedPrompt);
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  });
  
module.exports = router;