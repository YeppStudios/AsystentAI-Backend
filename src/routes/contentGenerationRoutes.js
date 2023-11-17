const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
router.use(express.json());
const requireTokens = require('../middlewares/requireTokens');
const requireTestTokens = require('../middlewares/requireTestTokens');
require('dotenv').config();
const axios = require('axios');
const Transaction = mongoose.model('Transaction');
const Workspace = mongoose.model('Workspace');
const User = mongoose.model('User');

const OpenAI = require("openai");

const openai = new OpenAI();

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
        const completion = await openai.chat.completions.create({
          model: model,
          messages,
          temperature
      });
      if (user.workspace) {
        const workspace = await Workspace.findById(user.workspace)
        const company = await User.findById(workspace.company[0].toString());
        if (model === "gpt-3.5-turbo" || model === "gpt-3.5-turbo-0613") {
          company.tokenBalance -= (completion.usage.total_tokens/10).toFixed(0);
        } else {
          company.tokenBalance -= completion.usage.total_tokens;
        }
        await company.save();
      } else {
        if (model === "gpt-3.5-turbo" || model === "gpt-3.5-turbo-0613") {
          user.tokenBalance -= (completion.usage.total_tokens/10).toFixed(0);
        } else {
          user.tokenBalance -= completion.usage.total_tokens;
        }
      }


      await user.save();
      return res.status(201).json({ completion: completion.choices[0].message.content, usage: completion.usage.total_tokens });
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
      const { prompt, model, systemPrompt, function_definition, temperature } = req.body;
      const user = await User.findById(req.user._id);

      const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
      ]
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          functions: [
            function_definition
          ],
          function_call: {"name": function_definition.name}
      });

      if (user.workspace) {
        const workspace = await Workspace.findById(user.workspace)
        const company = await User.findById(workspace.company[0].toString());
        company.tokenBalance -= completion.usage.total_tokens;
        await company.save();
      } else {
        user.tokenBalance -= completion.usage.total_tokens;
      }


      await user.save();
      return res.status(201).json({ function: completion.choices[0].message.function_call, usage: completion.usage.total_tokens });
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
        const completion = await openai.chat.completions.create({
            model: model,
            messages,
            temperature: temperature | 0.5,
            stream: true,
        });

        for await (const chunk of completion) {
            if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                res.write(`data: ${chunk.choices[0].delta.content}`);
                reply += chunk.choices[0].delta.content;
            }
        }

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

    } catch (error) {
            console.error('An error occurred during OpenAI request', error);
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

  const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      temperature: 0,
  });

  if (completion.choices[0].message.content !== '[%no_internet%]') {
    let data = JSON.stringify({
      "q": completion.choices[0].message.content
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
        const completion = await openai.chat.completions.create({
            model: model,
            messages: conversationContext,
            temperature: 0.7,
            frequency_penalty: 0.35,
            stream: true,
        });

        for await (const chunk of completion) {
            if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                res.write(`data: ${chunk.choices[0].delta.content}`);
                reply += chunk.choices[0].delta.content;
            }
        }

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
      const completion = await openai.chat.completions.create({
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

      completion.on('data', async data => {
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



router.post('/get-single-embedding', requireTokens, async (req, res) => {
  try {
      const { prompt, document_ids } = req.body;

      let context = '';
      try {
        const chunks = await axios.post(
          "https://www.asistant.ai/query",
          {
            "queries": [
              {
                "query": prompt,
                "filter": {
                  "document_id": document_ids
                },
                "top_k": 3
              }
            ]
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.PYTHON_API_KEY}`
            }
          }
        );
  

      chunks.data.results[0].results.forEach((item, index) => {
          context += ` ------ Context part ${index + 1} ------>` + item.text;
      });

    return res.status(201).json({ context: context });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ error: error.message });
    }

  } catch (error) {
    console.log(error);
    return res.status(500).send({ error: error.message });
  }
});


router.post('/completion-MSQT', requireTokens, async (req, res) => { // Multi-Step Query Transformation
  try {
      const { initial_prompt, embedding_result, document_ids } = req.body;
      const user = await User.findById(req.user._id);
      const messages = [
          { role: 'system', content: `Your role is to analyze the retrieved context and based on the query determine what info you lack to answer query. You always come up with 2 different follow up questions that might help you clarify inconsistencies or learn more about aspects not mentioned in context. You never ask about things you already understand from the context. You always come up with questions in given context's language. Along with the questions, you also compose a brief summary of most important informations that will help you respond to the initial query: "${initial_prompt}".` },
          { role: 'user', content: `Retrieved context: ${embedding_result}. Initial query you need to summarize and ask 2 followup questions: ${initial_prompt}.` }
      ]
      try {
      
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-0613",
          messages,
          temperature: 0.75,
          functions: [
            {
              "name": "ask_and_summarize",
              "description": `Analyze given context and ask 2 unique followup questions and a brief summary of most crucial points relevant to the query: "${initial_prompt}" in up to 300 characters that will help you get more informations necessary to fully answer the initial query.`,
              "parameters": {
                "type": "object",
                "properties": {
                  followup_questions: {
                    type: 'array',
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: `2 followup questions that will help you find more context to answer query: ${initial_prompt} ` },
                      }
                  }
                  },
                  brief_summary: {
                    type: 'string',
                    description: "brief summary in up to 300 characters of most important things you learned from the context that will help you answer the initial query"
                  },
                },
                "required": ["followup_questions", "brief_summary"]
              }
            }
          ],
          function_call: {"name": "ask_and_summarize"}
        });


        if (user.workspace) {
          const workspace = await Workspace.findById(user.workspace)
          const company = await User.findById(workspace.company[0].toString());
          company.tokenBalance -= completion.usage.total_tokens;
          await company.save();
        } else {
          user.tokenBalance -= completion.usage.total_tokens;
        }

      const function_response = JSON.parse(completion.choices[0].message.function_call.arguments)
      const questions = function_response.followup_questions;
      const brief_summary = function_response.brief_summary;

      let context = `Context information from multiple sources for you to interpret is below. 
      ----- Beginning Of The Context ----- 
      ${brief_summary}`;
      let fetched_doc_ids = [];

      for (let i = 0; i < questions.length; i++) {
          const chunks = await axios.post(
            "https://www.asistant.ai/query",
            {
              "queries": [
                {
                  "query": questions[i].question,
                  "filter": {
                    "document_id": document_ids
                  },
                  "top_k": 1
                }
              ]
            },
            {
              headers: {
                "Authorization": `Bearer ${process.env.PYTHON_API_KEY}`
              }
            }
          );
          context += "\n " + chunks.data.results[0].results[0].text;
          fetched_doc_ids.push(chunks.data.results[0].results[0].metadata.document_id);
      }
      context += "\n ----- End Of The Context ----- ";
      await user.save();
      return res.status(201).json({ questions: questions, context: context, fetched_doc_ids, usage: completion.usage.total_tokens });
      } catch (error) {
        console.log(error);
        return res.status(500).send({ error: error.message });
      }

    } catch (error) {
      console.log(error);
      return res.status(500).send({ error: error.message });
    }
});





module.exports = router;