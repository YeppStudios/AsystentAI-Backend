const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Calculator } = require("langchain/tools/calculator");
const { SerpAPI } = require("langchain/tools");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { PlanAndExecuteAgentExecutor } = require("langchain/experimental/plan_and_execute");

router.post('/askAgent', async (req, res) => {
    const tools = [new Calculator(), new SerpAPI()];
    const model = new ChatOpenAI({
        temperature: 0,
        modelName: "gpt-3.5-turbo",
        verbose: true,

    });
    const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools({
        llm: model,
        tools,
    });

    const result = await executor.call({
        input: `Who won the latest footbal world cup? Search in in google and tell me the result.`,
    });

    console.log({ result });
});




module.exports = router;
