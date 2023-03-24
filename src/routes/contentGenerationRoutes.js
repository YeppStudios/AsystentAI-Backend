const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const OpenAI = require('openai');
const { Configuration, OpenAIApi } = OpenAI;
const requireTokens = require('../middlewares/requireTokens');
const requireTestTokens = require('../middlewares/requireTestTokens');
require('dotenv').config();
const jobQueue = require('../queues/jobQueue');
const Transaction = mongoose.model('Transaction');

const configuration = new Configuration({
    organization: "org-oP1kxBXnJo6VGoYOLxzHnNSV",
    apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

async function attemptCompletion(params, retries = 2, delay = 350) {
    try {
        return await openai.createChatCompletion(params);
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying OpenAI API request (${retries} retries left)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await attemptCompletion(params, retries - 1, delay);
        } else {
            throw error;
        }
    }
}

router.post('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model } = req.body;
        let messages = [];
        const user = req.user;
        if(preprompt) {
            messages = [
                { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem, który jest mistrzem w generowaniu wysokiej jakości treści. Ograniczaj ilość emoji w generowanym tekście.' },
                { role: 'user', content: preprompt },
                { role: 'assistant', content: "Brzmi fascynująco, w czym mogę Ci pomóc?" },
                { role: 'user', content: prompt },
            ]
        } else {
            messages = [
                { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem, który jest mistrzem w generowaniu wysokiej jakości treści. Ograniczaj ilość emoji w generowanym tekście.' },
                { role: 'user', content: prompt }
            ]
        }
        const completion = await openai.createChatCompletion({
            model: model,
            messages,
            temperature: 0.8,
            frequency_penalty: 0.4,
            max_tokens: 2000,
            stream: true
        });
        // Decrease token balance
        user.tokenBalance -= completion.data.usage.total_tokens;

        const transaction = new Transaction({
            value: completion.data.usage.total_tokens,
            title: title,
            type: "expense",
            timestamp: Date.now()
        });

        user.transactions.push(transaction);
        
        user.tokenHistory.push({
            timestamp: Date.now(),
            balance: user.tokenBalance
        });

        await user.save();
        await transaction.save();
        return res.status(201).json({ response: completion.data.choices[0].message.content, tokens: completion.data.usage.total_tokens });

    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
});
  

router.post('/askAI-job', requireTokens, async (req, res) => {
    console.log("call")
    try {
      const { prompt, title, preprompt, model } = req.body;
      const user = req.user;
  
      const job = await jobQueue.add({
        userId: user._id, // Pass the user ID to the worker
        prompt,
        title,
        preprompt,
        model,
      });
  
      console.log(`Job added to the queue: ${job.id}`);
  
      res.status(200).json({
        message: 'Job added to the queue',
        jobId: job.id,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  });


router.post('/testAskAI', requireTestTokens, async (req, res) => {
    try {
        const { conversationContext } = req.body;
        const user = req.user;

        let messages = conversationContext;

        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
            temperature: 0.7,
            frequency_penalty: 0.35
        });

        user.testTokenBalance -= completion.data.usage.total_tokens;

        await user.save();

        return res.status(201).json({ response: completion.data.choices[0].message.content });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post('/promptConversation', requireTokens, async (req, res) => {
    try {
        const { conversationContext } = req.body;
        const user = req.user;

        let messages = conversationContext;

        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
            temperature: 0.7,
            frequency_penalty: 0.35
        });

        user.tokenBalance -= completion.data.usage.total_tokens;

        await user.save();
        return res.status(201).json({ response: completion.data.choices[0].message.content });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;