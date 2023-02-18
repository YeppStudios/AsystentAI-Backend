const OpenAI = require('openai');
const { Configuration, OpenAIApi } = OpenAI;
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireTokens = require('../middlewares/requireTokens');
const Message = mongoose.model('Message');
const Conversation = mongoose.model('Conversation');
require('dotenv').config();

const configuration = new Configuration({
    organization: "org-BurBlbC5xPRFDGqoCf19IkW8",
    apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);


router.post('/sendMessage/:conversationId', requireTokens, async (req, res) => {
    try {
        const { text } = req.body;
        const user = req.user;
        const conversation = await Conversation.findById(req.params.conversationId)
            .populate({
                path: 'messages',
                options: {
                    sort: { createdAt: -1 }
                },
                populate: {
                    path: 'sender'
                }
            });
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user._id.toString() !== user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const latestMessages = conversation.messages.slice(-2);

        let conversationContext = '';
        latestMessages.forEach(message => conversationContext += `\n ${message.text}`);
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Jesteś wszechwiedzącym, przyjaznym asystentem AI i rozmawiasz ze znajomym. 
            ${conversationContext}
            Znajomy: ${text}
            Asystent: `,
            max_tokens: 3000,
            temperature: 0.7,
            frequency_penalty: 0.35
        });
        // Decrease token balance
        user.tokenBalance -= response.data.usage.total_tokens;

        user.tokenHistory.push({
            timestamp: Date.now(),
            balance: user.tokenBalance
        });

        const userMessage = new Message({
            text: "Znajomy: " + text,
            conversation,
            sender: "User"
        });

        const assistantResponse = new Message({
            text: "Asystent: " + response.data.choices[0].text,
            conversation,
            sender: "Assistant"
        });
        
        await user.save();
        await userMessage.save();
        await assistantResponse.save();
        conversation.messages.push(userMessage);
        conversation.messages.push(assistantResponse);
        conversation.lastUpdated = Date.now();
        await conversation.save();

        return res.status(201).json({ response: response.data.choices[0].text });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.get('/messages/:conversationId', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId)
            .populate({
                path: 'messages',
                options: {
                    sort: { createdAt: -1 } // sort messages by createdAt in descending order
                },
                populate: {
                    path: 'sender'
                }
            });
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        return res.json({ messages: conversation.messages });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


// router.delete('/:id', requireAuth, async (req, res) => {
//     try {
//         const message = await Message.findById(req.params.id);
//         if (!message) return res.status(404).json({ message: 'Message not found' });
//         if (message.sender.toString() !== req.user._id.toString() && message.recipient.toString() !== req.user._id.toString()) {
//             return res.status(401).json({ message: 'Not authorized' });
//         }
//         await message.remove();
//         return res.json({ message: 'Message deleted' });
//     } catch (error) {
//         return res.status(500).json({ message: error.message });
//     }
// });

module.exports = router;