const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const Content = mongoose.model('Content');
const SeoContent = mongoose.model('SeoContent');
const moment = require('moment');

router.post('/addContent', requireAuth, async (req, res) => {
    const { text, prompt, category, savedBy, title, query, icon } = req.body;
    const newContent = new Content({ text, prompt, category, savedBy, title, query, icon });

    try {
        const savedContent = await newContent.save();
        res.status(201).json(savedContent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


router.patch('/updateContent/:id', requireAuth, async (req, res) => {
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


router.delete('/deleteContent/:id', requireAuth, async (req, res) => {
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
  

  router.get('/prepare-data', requireAdmin, async (req, res) => {
    try {
      const contents = await Content.find({ 
        category: { 
          $in: [
            'Facebook-post', 'Facebook',
            'Instagram-post', 'Instagram',
            'Twitter', 'Twitter-post',
            'Linkedin-post', 'LinkedIn'
          ] 
        } 
      });
  
      // Transform data to the desired output format
      const transformedContents = contents.map(content => {
        return {
          messages: [
            {
              role: 'system',
              content: 'You are a professional marketer with many years of experience. You write professional marketing content for the user based on best practices, marketing principles and information user gives you. You do not overuse emojis in the text and adjust the tone and context to perfectly match the keywords and target audience.'
            },
            {
              role: 'user',
              content: content.prompt
            },
            {
              role: 'assistant',
              content: content.text
            }
          ]
        };
      });
  
      res.status(200).json(transformedContents);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  

  router.get('/getContentPiece/:id', requireAuth, async (req, res) => {
    try {
      const contentId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        res.status(400).json({ message: 'Invalid content ID' });
        return;
      }
  
      const content = await Content.findById(contentId);
      if (!content) {
        res.status(404).json({ message: 'Content not found' });
      } else {
        res.status(200).json(content);
      }
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  
  router.get('/getUserSavedContent', requireAuth, async (req, res) => {
    try {
      const contents = await Content.find({ savedBy: req.user._id })
        .sort({ timestamp: -1 }) // Sort contents by timestamp in descending order (newest to oldest)
        .populate('savedBy', 'email') // Populate email from User model
        .lean(); // Convert Mongoose documents to plain JavaScript objects
  
      const contentsWithCustomTimestamp = contents.map((content) => {
        // Calculate time difference in days
        const daysAgo = moment().diff(moment(content.timestamp), 'days');
  
        // Format timestamp based on daysAgo
        const customTimestamp = daysAgo === 0
          ? 'Today'
          : daysAgo === 1
            ? '1 day ago'
            : `${daysAgo} days ago`;
  
        return {
          ...content,
          timestamp: customTimestamp,
          savedBy: content.savedBy.email, // Replace savedBy with the email
        };
      });
  
      res.status(200).json(contentsWithCustomTimestamp);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  

  // Endpoint to fetch all SeoContent documents
router.get('/seocontents', requireAdmin, async (req, res) => {
  try {
    const seocontents = await SeoContent.find();
    return res.json(seocontents);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/getUserSeoContent', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const seocontents = await SeoContent.find({ owner: userId }).sort({ timestamp: -1 });
    const contentsWithCustomTimestamp = seocontents.map((content) => {
      const daysAgo = moment().diff(moment(content.timestamp), 'days');

      // Format timestamp based on daysAgo
      const customTimestamp = daysAgo === 0
        ? 'Today'
        : daysAgo === 1
          ? '1 Day ago'
          : `${daysAgo} days ago`;

      return {
        ...content,
        timestamp: customTimestamp,
        title: content.title,
        owner: content.owner,
        content: content.content,
        savedBy: content.savedBy,
        _id: content._id,
      };
    });
    return res.json(contentsWithCustomTimestamp);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


// Endpoint to fetch a single SeoContent document by id
router.get('/seoContent/:id', requireAuth, async (req, res) => {
  try {
    let seocontent = await SeoContent.findById(req.params.id);
    if (seocontent == null) {
      return res.status(404).json({ message: 'Cannot find SeoContent' });
    } else {
      return res.json(seocontent);
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Endpoint to save a new SeoContent document
router.post('/addSeoContent', requireAuth, async (req, res) => {
  const seocontent = new SeoContent({
    title: req.body.title,
    content: req.body.content,
    owner: req.body.owner,
    savedBy: req.body.savedBy
  });

  try {
    const newSeoContent = await seocontent.save();
    return res.status(201).json(newSeoContent);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.patch('/updateSeoContent/:id', requireAuth, async (req, res) => {
  try {
    // verify owner
    const seocontent = await SeoContent.findById(req.params.id);
    if (seocontent.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (seocontent) {
      const { title, content } = req.body;
      if (title) {
        seocontent.title = title;
      }
      if (content) {
        seocontent.content = content;
      }
      seocontent.timestamp = Date.now();
      await seocontent.save();
      return res.json(seocontent);
    } else {
      return res.status(404).json({ message: 'No such SEO content found' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message });
  }
});

router.delete('/deleteSeoContent/:id', requireAuth, async (req, res) => {
  try {
    const seocontent = await SeoContent.findById(req.params.id);

    if (!seocontent) {
      return res.status(404).json({ message: 'No such SEO content found' });
    }

    if (seocontent.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await seocontent.remove();
    res.json({ message: 'SEO Content deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;