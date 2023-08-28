const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
router.use(express.json());
const OpenAI = require('openai');
const { Configuration, OpenAIApi } = OpenAI;
const requireTokens = require('../middlewares/requireTokens');
const requireTestTokens = require('../middlewares/requireTestTokens');
require('dotenv').config();
const axios = require('axios');
const Transaction = mongoose.model('Transaction');
const Workspace = mongoose.model('Workspace');
const User = mongoose.model('User');

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

router.post('/completion', requireTokens, async (req, res) => {
  try {
      const { prompt, model, systemPrompt, temperature } = req.body;
      const user = await User.findById(req.user._id);

      const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
      ]
      try {
        const completion = await openai.createChatCompletion({
          model: model,
          messages,
          temperature
      });
      if (user.workspace) {
        const workspace = await Workspace.findById(user.workspace)
        const company = await User.findById(workspace.company[0].toString());
        company.tokenBalance -= completion.data.usage.total_tokens;
        await company.save();
      } else {
        user.tokenBalance -= completion.data.usage.total_tokens;
      }


      await user.save();
      return res.status(201).json({ completion: completion.data.choices[0].message.content, usage: completion.data.usage.total_tokens });
      } catch (error) {
        console.log(error);
        return res.status(500).send({ error: error.message });
      }

  } catch (error) {
    console.log(error);
    return res.status(500).send({ error: error.message });
  }
});

router.post('/completion-function', requireTokens, async (req, res) => {
  try {
      const { prompt, model, systemPrompt,function_definition, temperature } = req.body;
      const user = await User.findById(req.user._id);

      const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
      ]
      try {
        const completion = await openai.createChatCompletion({
          model: model | "gpt-4-0613",
          messages,
          temperature,
          functions: [
            function_definition
          ]
      });
      if (user.workspace) {
        const workspace = await Workspace.findById(user.workspace)
        const company = await User.findById(workspace.company[0].toString());
        company.tokenBalance -= completion.data.usage.total_tokens;
        await company.save();
      } else {
        user.tokenBalance -= completion.data.usage.total_tokens;
      }


      await user.save();
      return res.status(201).json({ completion: completion.data.choices[0].message.content, usage: completion.data.usage.total_tokens });
      } catch (error) {
        console.log(error);
        return res.status(500).send({ error: error.message });
      }

  } catch (error) {
    console.log(error);
    return res.status(500).send({ error: error.message });
  }
});

router.post('/askAI', requireTokens, async (req, res) => {
    try {
        const { prompt, title, preprompt, model, systemPrompt, temperature } = req.body;
        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let reply = '';
        let messages = [];
        if(preprompt) {
            messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: preprompt },
                { role: 'assistant', content: "Brzmi fascynująco, w czym mogę Ci pomóc?" },
                { role: 'user', content: prompt },
            ]
        } else {
            messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        }
        messages.forEach(message => {
            inputTokens += estimateTokens(message.content);
        });
        const completion = await openai.createChatCompletion({
            model: model,
            messages,
            temperature: temperature | 0.5,
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
                    outputTokens = estimateTokens(reply);
                    const totalTokens = inputTokens + outputTokens;
                    if (user.workspace) {
                      const workspace = await Workspace.findById(user.workspace);
                      const company = await User.findById(workspace.company[0].toString());
                      company.tokenBalance -= totalTokens;
                      await company.save();
                    } else {
                      user.tokenBalance -= (totalTokens);
                    }

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


router.post('/fetch-links', requireTokens, async (req, res) => {
  const { query } = req.body;

  const messages = [
    { role: 'system', content: `Your only job is to figure out the best optimised Google search query that will give you just enough information to compose an educated answer. 
    Part of the user query might be a task for you that you should not include into Google search query.
    Rules you always follow:
    - You modify text in a language in which user asks. 
    - You reply ONLY with the modified query, no word more.
    - If the user query doesn't require the web search to answer it return exactly [%no_internet%].`},
    { role: 'user', content: "Query: " + query }
  ]

  const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages,
      temperature: 0,
  });

  if (completion.data.choices[0].message.content !== '[%no_internet%]') {
    let data = JSON.stringify({
      "q": completion.data.choices[0].message.content
    });

    let config = {
      method: 'post',
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': process.env.SERP_API_KEY, 
        'Content-Type': 'application/json'
      },
      data : data
    };

    axios(config)
    .then((response) => {
      // Extract top 3 links from the organic results
      const top3Links = response.data.organic.slice(0, 3).map(result => result.link);
      return res.json(top3Links);
    })
    .catch((error) => {
      return res.status(500).json({ message: error });
    });
  } else {
    return res.json(["[%no_internet%]"]);
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
                    if (user.workspace) {
                      const workspace = await Workspace.findById(user.workspace)
                      const company = await User.findById(workspace.company[0].toString());
                      company.tokenBalance -= totalTokens;
                      await company.save();
                    } else {
                      user.tokenBalance -= (totalTokens);
                    }

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
      const { prompt, model, systemPrompt } = req.body;
      const user = req.user;
      let inputTokens = 0;
      let outputTokens = 0;
      let reply = '';
      let messages = [
          { role: 'system', content: `${systemPrompt} Pisząc treść nowe linie rozpoczynaj od \n \n` },
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
                  if (user.workspace) {
                    const workspace = await Workspace.findById(user.workspace)
                    const company = await User.findById(workspace.company[0].toString());
                    company.tokenBalance -= totalTokens;
                    await company.save();
                  } else {
                    user.tokenBalance -= (totalTokens);
                  }

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
            model: "gpt-4",
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