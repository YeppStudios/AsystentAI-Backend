const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const Conversation = mongoose.model('Conversation');
const moment = require('moment');


router.post('/createConversation', requireAuth, async (req, res) => {
    const user = req.user;
    const { assistantId } = req.body;
    let id = "1";

    if(assistantId) {
        id = assistantId;
    }

    try {      
        const conversation = new Conversation({
            user,
            startTime: Date.now(),
            assistant: id
        });
        await conversation.save();
        return res.status(201).json({ conversation });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/getConversations', requireAuth, async (req, res) => {
    const user = req.user;
  
    try {
      const conversations = await Conversation.find({ user: user._id })
        .sort({ lastUpdated: -1 })
        .populate('user', 'email') // Populate email from User model
        .populate('assistant', 'name') // Populate name from Assistant model
        .populate({
          path: 'messages',
          populate: {
            path: 'sender',
            select: 'email',
          },
        })
        .lean(); // Convert Mongoose documents to plain JavaScript objects
  
      if (!conversations) {
        return res.status(404).json({ message: 'Nie znaleziono konwersacji' });
      }
  
      const conversationsWithCustomTimestamp = conversations.map((conversation) => {
        // Calculate time difference in days
        const daysAgo = moment().diff(moment(conversation.lastUpdated), 'days');
  
        // Format timestamp based on daysAgo
        const customTimestamp =
          daysAgo === 0
            ? 'Dzisiaj'
            : daysAgo === 1
            ? '1 Dzień temu'
            : `${daysAgo} dni temu`;
  
        // Replace user and assistant fields with their email and name respectively
        return {
          ...conversation,
          user: conversation.user.email,
          assistant: conversation.assistant ? conversation.assistant.name : '',
          lastUpdated: customTimestamp,
          messages: conversation.messages.map((message) => {
            return {
              ...message,
              sender: message.sender.email,
            };
          }),
        };
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
      returnres.status(500).json({ message: 'Internal server error.' });
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