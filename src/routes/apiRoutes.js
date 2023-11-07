const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireTokens = require('../middlewares/requireTokens');
const Message = mongoose.model('Message');
const Conversation = mongoose.model('Conversation');
const Transaction = mongoose.model('Transaction');
const User = mongoose.model('User');
const Workspace = mongoose.model('Workspace');
const Assistant = mongoose.model('Assistant');
const Document = mongoose.model('Document');
const axios = require('axios');
require('dotenv').config();

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


router.post('/message-stream', requireTokens, async (req, res) => {
    try {
        const { query, assistant_id, conversation_id, llm } = req.body;

        const user = req.user;
        let inputTokens = 0;
        let outputTokens = 0;
        let response = '';
        let  context = "";
        let systemPrompt = "You are a helpful AI assistant with expert knowledge in marketing. You avoid controversial topics and you never guarantee anything.";
        let conversation = null;
        let embeddingContext = "";
        let assistant = null;
        let assistantName = "Default Assistant";
        let model = "gpt-4"

        if (llm) {
            model = llm;
        }

        if (assistant_id) {
            let fetchedAssistant = await Assistant.findById(assistant_id).populate('documents').exec();
            if (!fetchedAssistant) {
                return res.status(404).json({ message: 'Assistant not found' });
            }
        
              if (fetchedAssistant.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'You are not authorized- this Assistant is not yours' });
              }
              assistant = fetchedAssistant;
              systemPrompt = assistant.noEmbedPrompt;
              assistantName = assistant.name;

              let vectorIds = assistant.documents.map(doc => doc.vectorId);
              try {
                  const chunks = await axios.post(
                  "https://www.asistant.ai/query",
                  {
                      "queries": [
                      {
                          "query": query,
                          "filter": {
                          "document_id": vectorIds
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
          
                  chunks.data.results[0].results.forEach((item) => {
                      context += item.text + " ";
                  });
                  embeddingContext = `Context you might find helpful: ${context}. Task for you to do: `;

              } catch (e) {
                  return res.status(500).json({ error: e.message });
              }
        }

        if (conversation_id) {
            conversation = await Conversation.findById(conversation_id)
                .populate({
                    path: 'messages',
                    options: {
                        sort: { createdAt: -1 }
                    },
                    populate: {
                        path: 'sender'
                    }
            });
        } else {
            conversation = new Conversation({
                user: req.user,
                startTime: Date.now(),
                assistant: assistant || null,
                lastUpdated: Date.now(),
                title: "New conversation"
            });
            await conversation.save();
        }
              
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user._id.toString() !== user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const latestMessages = conversation.messages.slice(-4);
        const messagesText = latestMessages.map((message) => message.text).join(" ");
        const messages = [  { role: "system", content: systemPrompt },  ...latestMessages.map((message) => {    
            return {role: message.sender,  content: message.text};
        }), { role: "user", content: `${embeddingContext} ${query}`},];

        try {
            const completionStream = await openai.chat.completions.create({
                model: model,
                messages: messages,
                temperature: 0.4,
                stream: true,
            });
          
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
          
            let response = ""; // Initialize response variable to accumulate text
          
            for await (const chunk of completionStream) {
                if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    const content = chunk.choices[0].delta.content;
                    res.write(`data: ${content}\n\n`); // Write the chunk to the stream in SSE format
                    response += content; // Accumulate the response text
                }
          
                if (chunk.choices && chunk.choices[0].finish_reason === "stop") {
                    outputTokens = estimateTokens(response);
                    inputTokens += estimateTokens(messagesText);
                    inputTokens += estimateTokens(systemPrompt);
                    inputTokens += estimateTokens(embeddingContext);
                    inputTokens += estimateTokens(query);
                    let totalTokens = inputTokens + outputTokens;

                    if (user.workspace) {
                        const workspace = await Workspace.findById(user.workspace)
                        const company = await User.findById(workspace.company);
                        company.tokenBalance -= totalTokens;
                        await company.save();
                      } else {
                        user.tokenBalance -= (totalTokens);
                      }
                    if (response !== '[%fetch_info%]' && response !== '[fetch_info]') {
                        const transaction = new Transaction({
                            title: "Message in chat",
                            value: totalTokens,
                            type: "expense",
                            timestamp: Date.now(),
                            category: "chat",
                            user: user._id
                        });
                        user.tokenHistory.push({
                            timestamp: Date.now(),
                            balance: user.tokenBalance
                        });

                        const userMessage = new Message({
                            text: query,
                            conversation,
                            sender: "user"
                        });
                        const assistantResponse = new Message({
                            text: response,
                            conversation,
                            sender: "assistant",
                        });
                        await user.save();
                        await userMessage.save();
                        await assistantResponse.save();
                        await transaction.save();
                        if (assistant_id) {
                            conversation.messages.push(userMessage);
                            conversation.messages.push(assistantResponse);
                            conversation.lastUpdated = Date.now();
                            await conversation.save();
                        }
                    }
                    res.write('\n\n'); // End the SSE stream
                    res.end(); // Close the response
                    break; // Exit the loop as the completion is done
                }
            }
          } catch (error) {
            console.error('Stream error:', error);
            res.status(500).send('Internal Server Error');
          }

    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
});

router.post('/message', requireTokens, async (req, res) => {
    try {
        const { query, assistant_id, conversation_id, llm } = req.body;

        const user = req.user;
        let systemPrompt = "You are helpful Assistant AI. You are always positive, helpful and insightful. You are a great listener and you always do what user says. You communicate in user language.";
        let documents = [];
        let embeddingContext = "";
        let conversation = null;
        let context = "";
        let assistant = null;
        let assistantName = "Default Assistant"
        let model = "gpt-4"

        if (llm) {
            model = llm;
        }
        if (assistant_id) {
            let fetchedAssistant = await Assistant.findById(assistant_id).populate('documents').exec();
            if (!fetchedAssistant) {
                return res.status(404).json({ message: 'Assistant not found' });
            }
        
              if (fetchedAssistant.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'You are not authorized- this Assistant is not yours' });
              }
              assistant = fetchedAssistant;
              systemPrompt = assistant.noEmbedPrompt;
              assistantName = assistant.name;

              let vectorIds = assistant.documents.map(doc => doc.vectorId);
              try {
                  const chunks = await axios.post(
                  "https://www.asistant.ai/query",
                  {
                      "queries": [
                      {
                          "query": query,
                          "filter": {
                          "document_id": vectorIds
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
          
                  chunks.data.results[0].results.forEach((item) => {
                      context += item.text + " ";
                  });
                  embeddingContext = `Context you might find helpful: ${context}. Task for you to do: `;

              } catch (e) {
                  return res.status(500).json({ error: e.message });
              }
        }

        if (conversation_id) {
        conversation = await Conversation.findById(conversation_id)
            .populate({
                path: 'messages',
                options: {
                    sort: { createdAt: -1 }
                },
                populate: {
                    path: 'sender'
                }
        });
        } else {
            conversation = new Conversation({
                user: req.user,
                startTime: Date.now(),
                assistant: assistant || null,
                lastUpdated: Date.now(),
                title: "New conversation"
            });
            await conversation.save();
        }
            
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        if (conversation.user._id.toString() !== user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const latestMessages = conversation.messages.slice(-4);
        const messages = [  { role: "system", content: systemPrompt },  ...latestMessages.map((message) => {    
            return {role: message.sender,  content: message.text};
        }), { role: "user", content: `${embeddingContext} ${query}`},];
        const completion = await openai.chat.completions.create({
            model: model,
            messages,
            temperature: 0.4,
        });

        const userMessage = new Message({
            text: query,
            conversation,
            sender: "user"
        });
        const assistantResponse = new Message({
            text: completion.choices[0].message.content,
            conversation,
            sender: "assistant",
            documents
        });

        await user.save();
        await userMessage.save();
        await assistantResponse.save();
        if (assistant_id) {
            conversation.messages.push(userMessage);
            conversation.messages.push(assistantResponse);
            conversation.lastUpdated = Date.now();
            await conversation.save();
        }
        if (user.workspace) {
            const workspace = await Workspace.findById(user.workspace)
            const company = await User.findById(workspace.company);
            company.tokenBalance -= completion.usage.total_tokens;
            await company.save();
        } else {
            user.tokenBalance -= completion.usage.total_tokens;
        }

        return res.status(201).json({ response: completion.choices[0].message.content, elixir_used: completion.data.usage.total_tokens, based_on: assistant_id ? assistant.documents.map(doc => doc.title) : [], assistant: assistantName, conversation_id: conversation._id });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
});


module.exports = router;