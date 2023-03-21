const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const OpenAI = require('openai');
const { Configuration, OpenAIApi } = OpenAI;
const requireTokens = require('../middlewares/requireTokens');
const requireTestTokens = require('../middlewares/requireTestTokens');
require('dotenv').config();
const Transaction = mongoose.model('Transaction');

const configuration = new Configuration({
    organization: "org-oP1kxBXnJo6VGoYOLxzHnNSV",
    apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

router.post('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model } = req.body;
        const text = prompt.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
        let messages = [];

        const user = req.user;
        if(preprompt) {
            messages = [
                { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem.' },
                { role: 'user', content: preprompt },
                { role: 'assistant', content: "Brzmi fascynująco, w czym mogę Ci pomóc?" },
                { role: 'user', content: text },
            ]
        } else {
            messages = [
                { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem.' },
                { role: 'user', content: text }
            ]
        }
        
        const completion = await openai.createChatCompletion({
            model: model,
            messages,
            temperature: 0.8,
            frequency_penalty: 0.4
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
        console.log(error.response)
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

router.post('/ligaAskAI', async (req, res) => {
    try {
        const { text, conversationContext } = req.body;

        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Jesteś Ignacym Łukasiewiczem. Prowadzisz rozmowę z uczniem odpowiadając na jego pytania i wiadomości w uprzejmy sposób. Odpowiadasz tylko za Ignacego.
            ${conversationContext}
            Uczeń: ${text}
            Ignacy:`,
            max_tokens: 2500,
            temperature: 0.7,
            frequency_penalty: 0.4
        });

        return res.status(201).json({ response: response.data.choices[0].text });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;