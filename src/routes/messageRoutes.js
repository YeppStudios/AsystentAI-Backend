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
    organization: "org-oP1kxBXnJo6VGoYOLxzHnNSV",
    apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

function estimateTokens(text) {
    const tokenRegex = /[\p{L}\p{N}]+|[^ \t\p{L}\p{N}]/ug;
    let tokens = 0;
    let match;
  
    while ((match = tokenRegex.exec(text)) !== null) {
      tokens += 1;
    }
  
    return tokens;
}

router.post('/send',async (req, res) => {
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo-0301",
        messages: [  { role: 'system', content: 'Jesteś pomocnym asystentem.' },
        { role: 'user', content: 'Cześć' }
      ],
      });
      console.log(completion.data.choices[0].message);
});


router.post('/sendMessage/:conversationId', requireTokens, async (req, res) => {
    try {
        const { text } = req.body;
        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let response = '';
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

        const latestMessages = conversation.messages.slice(-4);
        const messages = [  { role: "system", content: "Jesteś pomocnym asystentem." },  ...latestMessages.map((message) => {    
            return {role: message.sender,  content: message.text,};
        }), { role: "user", content: text },];

        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
            temperature: 0.8,
            frequency_penalty: 0.35,
            stream: true,
        }, { responseType: 'stream' });
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        completion.data.on('data', async data => {
            const lines = data.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
              const message = line.replace(/^data: /, '');
              if (message === '[DONE]') {
                res.write('\n\n');
                res.end();
                return;
              } else {
                try {
                  const parsed = JSON.parse(message);
                  if(parsed.choices[0].finish_reason === "stop"){ //when generating response ends
                    res.write('\n\n');
                    outputTokens = estimateTokens(response);
                    const totalTokens = inputTokens + outputTokens;
                    user.tokenBalance -= totalTokens;

                    user.tokenHistory.push({
                        timestamp: Date.now(),
                        balance: user.tokenBalance
                    });

                    const userMessage = new Message({
                        text: text,
                        conversation,
                        sender: "user"
                    });
                    const assistantResponse = new Message({
                        text: response,
                        conversation,
                        sender: "assistant"
                    });
                    await user.save();
                    await userMessage.save();
                    await assistantResponse.save();
                    conversation.messages.push(userMessage);
                    conversation.messages.push(assistantResponse);
                    conversation.lastUpdated = Date.now();
                    await conversation.save();
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                    response += parsed.choices[0].delta.content
                  }
                } catch(error) {
                  console.error('Could not JSON parse stream message', message, error);
                }
              }
            }
          });

    } catch (error) {
        console.log(error)
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