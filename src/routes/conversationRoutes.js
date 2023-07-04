const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const Conversation = mongoose.model('Conversation');
const moment = require('moment');


router.post('/createConversation', requireAuth, async (req, res) => {
    const user = req.user;
    const { assistant_id, title } = req.body;
    let id = "1";
    let conversationTitle = "New conversation";
    if (title) {
        conversationTitle = title;
    }

    if(assistant_id) {
        id = assistant_id;
    }

    try {      
        const conversation = new Conversation({
            user,
            startTime: Date.now(),
            assistant: id,
            lastUpdated: Date.now(),
            title: conversationTitle
        });
        await conversation.save();
        return res.status(201).json({ conversation });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/getConversations/:assistantId', requireAuth, async (req, res) => {
    const user = req.user;
    const assistantId = req.params.assistantId;
  
    try {
      const conversations = await Conversation.find({ 
        user: user._id, 
        assistant: mongoose.Types.ObjectId(assistantId) 
      }).sort({ lastUpdated: -1 }).lean();
  
      const conversationsWithCustomTimestamp = conversations.map((conversation) => {
        // Calculate time difference in days
        const daysAgo = moment().diff(moment(conversation.startTime), 'days');
  
        // Format timestamp based on daysAgo
        const customTimestamp = daysAgo === 0
          ? 'Ostatne 24h'
          : daysAgo === 1
            ? '1 dzień temu'
            : `${daysAgo} dni temu`;
  
        // Update the lastUpdated field with custom timestamp
        conversation.lastUpdated = customTimestamp;
  
        return conversation;
      });
  
      return res.json({ conversations: conversationsWithCustomTimestamp });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });  
  

router.get('/getLatestConversation', requireAuth, async (req, res) => {
    const user = req.user;

    try {
        const latestConversation = await Conversation.findOne({ user: user._id }).sort({ lastUpdated: -1 }).limit(1);
        return res.json({ latestConversation });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.get('/getConversation/:id', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        return res.json({ conversation });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/latest-conversation/:assistantId', requireAuth, async (req, res) => {
    try {
      const conversation = await Conversation.findOne({ assistant: req.params.assistantId })
                                             .sort({ lastUpdated: -1 })
                                             .populate('messages');
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found.' });
      }

      if (conversation.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized' });
    }
        return res.json({ latestConversation: conversation });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  });
  

router.delete('/deleteConversation/:id', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        await conversation.remove();
        return res.json({ message: 'Conversation deleted' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.patch('/updateConversationTitle', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.body._id);
        if (conversation.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        conversation.title = req.body.title;
        await conversation.save();
        return res.json(conversation);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});


router.delete('/deleteAllConversations', requireAuth, async (req, res) => {
    try {
        const conversations = await Conversation.find({ user: req.user._id });
        if (!conversations) {
            return res.status(404).json({ message: 'Conversations not found' });
        }
        await Conversation.deleteMany({ user: req.user._id });
        return res.json({ message: 'All conversations deleted' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});



module.exports = router;