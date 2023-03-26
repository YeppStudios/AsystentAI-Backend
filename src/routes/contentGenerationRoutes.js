const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
router.use(express.json());
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


router.post('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model } = req.body;
        const user = req.user;

        let messages = [];
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
                  if(parsed.choices[0].finish_reason === "stop"){
                    res.write('\n\n');
                    user.tokenBalance -= 0;
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
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                  }
                } catch(error) {
                  console.error('Could not JSON parse stream message', message, error);
                }
              }
            }
          });
    } catch (error) {
        if (error.response?.status) {
            console.error(error.response.status, error.message);
            error.response.data.on('data', data => {
                const message = data.toString();
                try {
                    const parsed = JSON.parse(message);
                    console.error('An error occurred during OpenAI request: ', parsed);
                } catch(error) {
                    console.error('An error occurred during OpenAI request: ', message);
                }
            });
        } else {
            console.error('An error occurred during OpenAI request', error);
        }
    }
});

router.post('/messageAI', requireTokens, async (req, res) => {
    try {
        const { conversationContext } = req.body;
        const user = req.user;

        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: conversationContext,
            temperature: 0.7,
            frequency_penalty: 0.35,
            stream: true,
        }, { responseType: 'stream' });
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        completion.data.on('data', data => {
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
                  if(parsed.choices[0].finish_reason === "stop"){
                    res.write('\n\n');
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                  }
                } catch(error) {
                  console.error('Could not JSON parse stream message', message, error);
                }
              }
            }
          });
    } catch (error) {
        if (error.response?.status) {
            console.error(error.response.status, error.message);
            error.response.data.on('data', data => {
                const message = data.toString();
                try {
                    const parsed = JSON.parse(message);
                    console.error('An error occurred during OpenAI request: ', parsed);
                } catch(error) {
                    console.error('An error occurred during OpenAI request: ', message);
                }
            });
        } else {
            console.error('An error occurred during OpenAI request', error);
        }
    }
});


module.exports = router;