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
        const completion = await attemptCompletion({
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
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
});
  
router.get('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model } = req.query;
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

        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Transfer-Encoding': 'chunked'
        });

        const completion = await openai.createChatCompletion({
            model: model,
            messages,
            temperature: 0.8,
            frequency_penalty: 0.4,
            stream: true
        });

        const responseStream = completion.data.choices[0].text.stream();

        for await (const chunk of responseStream) {
            if (!res.writableEnded) {
                const response = `<html><body><p>${chunk}</p></body></html>`;
                res.write(response);
            }
        }

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

        res.end();

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
        return res.status(201).json({ response: completion.data.choices[0].message.content, tokens: completion.data.usage.total_tokens });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/message-stream', async (req, res) => {
    try {
        const user = req.user;
        let messages = [
            { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem, który jest mistrzem w generowaniu wysokiej jakości treści. Ograniczaj ilość emoji w generowanym tekście.' },
            { role: 'user', content: "Cześć, jak się masz?" }
        ]
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages,
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
                completion.data.destroy();
                res.write('\n\n');
                return;
              } else {
                try {
                  const parsed = JSON.parse(message);
                  if(parsed.choices[0].delta.content) {
                    console.log(parsed.choices[0].delta.content);
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