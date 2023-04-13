const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
router.use(express.json());
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

function estimateTokens(text) {
    const tokenRegex = /[\p{L}\p{N}]+|[^ \t\p{L}\p{N}]/ug;
    let tokens = 0;
    let match;
  
    while ((match = tokenRegex.exec(text)) !== null) {
      tokens += 1;
    }
  
    return tokens;
}

router.post('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model } = req.body;
        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let reply = '';
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
        messages.forEach(message => {
            inputTokens += estimateTokens(message.content);
        });
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

        const heartbeatInterval = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 28000);

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
                    outputTokens = estimateTokens(reply);
                    const totalTokens = inputTokens + outputTokens;
                    user.tokenBalance -= (totalTokens);

                    const transaction = new Transaction({
                        value: totalTokens,
                        title: title,
                        type: "expense",
                        timestamp: Date.now(),
                        category: "forms",
                        user: user._id
                    });
            
                    user.transactions.push(transaction);
                    
                    user.tokenHistory.push({
                        timestamp: Date.now(),
                        balance: user.tokenBalance
                    });
            
                    await user.save();
                    if(user.email != "gerke.contact@gmail.com" && user.email != "piotrg2003@gmail.com"){
                      await transaction.save();
                    }
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                    reply += parsed.choices[0].delta.content;
                  }
                } catch(error) {
                  console.error('Could not JSON parse stream message', message, error);
                }
              }
            }
          });

          req.on('close', () => {
            clearInterval(heartbeatInterval);
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
        const { conversationContext, model } = req.body;

        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let reply = '';
        conversationContext.forEach(message => {
            inputTokens += estimateTokens(message.content);
        });
        const completion = await openai.createChatCompletion({
            model: model,
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

        const heartbeatInterval = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 28000);


        completion.data.on('data', async  data => {
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
                    outputTokens = estimateTokens(reply);
                    const totalTokens = inputTokens + outputTokens;
                    user.tokenBalance -= totalTokens;
                    const transaction = new Transaction({
                      title: "Message in prompt search engine",
                      type: "expense",
                      value: totalTokens,
                      timestamp: Date.now(),
                      category: "prompts",
                      user: user._id
                    });
                    await user.save();
                    if(user.email != "gerke.contact@gmail.com" && user.email != "piotrg2003@gmail.com"){
                      await transaction.save();
                    }
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                    reply += parsed.choices[0].delta.content;
                  }
                } catch(error) {
                  console.error('Could not JSON parse stream message', message, error);
                }
              }
            }
          });
          
          req.on('close', () => {
            clearInterval(heartbeatInterval);
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

router.post('/compose-editor-completion', requireTokens, async (req, res) => {
  try {
      const { prompt, model } = req.body;
      const user = req.user;
      let inputTokens = 0;
      let outputTokens = 0;
      let reply = '';
      let messages = [
          { role: 'system', content: 'Jesteś przyjaznym, pomocnym i wszechwiedzącym copywriterem. Specjalizujesz się w generowaniu wysokiej jakości treści marketingowych i SEO. Nowe linie rozpoczynaj od \n \n' },
          { role: 'user', content: prompt }
      ]
      messages.forEach(message => {
          inputTokens += estimateTokens(message.content);
      });
      const completion = await openai.createChatCompletion({
          model: model,
          messages,
          temperature: 0.75,
          frequency_penalty: 0.35,
          stream: true,
      }, { responseType: 'stream' });
      res.set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
      });

      const heartbeatInterval = setInterval(() => {
          res.write(':heartbeat\n\n');
      }, 28000);

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
                  outputTokens = estimateTokens(reply);
                  const totalTokens = inputTokens + outputTokens;
                  user.tokenBalance -= (totalTokens);

                  const transaction = new Transaction({
                      value: totalTokens,
                      title: "text editor completion",
                      type: "expense",
                      timestamp: Date.now(),
                      category: "text-editor",
                      user: user._id
                  });
                  
                  user.tokenHistory.push({
                      timestamp: Date.now(),
                      balance: user.tokenBalance
                  });
          
                  await user.save();
                  if(user.email != "gerke.contact@gmail.com" && user.email != "piotrg2003@gmail.com"){
                    await transaction.save();
                  }
                  res.end();
                  return;
                } else if(parsed.choices[0].delta.content) {
                  res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                  reply += parsed.choices[0].delta.content;
                }
              } catch(error) {
                console.error('Could not JSON parse stream message', message, error);
              }
            }
          }
        });

        req.on('close', () => {
          clearInterval(heartbeatInterval);
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


router.post('/testMessageAI', requireTestTokens, async (req, res) => {
    try {
        const { conversationContext } = req.body;
        
        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let reply = '';
        conversationContext.forEach(message => {
            inputTokens += estimateTokens(message.content);
        });
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

        completion.data.on('data', async  data => {
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
                    outputTokens = estimateTokens(reply);
                    const totalTokens = inputTokens + outputTokens;
                    user.testTokenBalance -= totalTokens;
                    await user.save();
                    res.end();
                    return;
                  } else if(parsed.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(parsed.choices[0].delta)}\n\n`);
                    reply += parsed.choices[0].delta.content;
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