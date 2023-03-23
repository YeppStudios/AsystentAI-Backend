// worker.js
const jobQueue = require('./src/queues/jobQueue');
const User = require('./src/models/User');
const Transaction = require('./src/models/Transaction');

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
 
async function processJob(job) {
  const { userId, prompt, title, preprompt, model } = job.data;

  const user = await User.findById(userId);

  let messages = [];
  if (preprompt) {
    messages = [
      { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem, który jest mistrzem w generowaniu wysokiej jakości treści. Ograniczaj ilość emoji w generowanym tekście.' },
      { role: 'user', content: preprompt },
      { role: 'assistant', content: "Brzmi fascynująco, w czym mogę Ci pomóc?" },
      { role: 'user', content: prompt },
    ];
  } else {
    messages = [
      { role: 'system', content: 'Jesteś przyjaznym, pomocnym copywriterem i marketerem, który jest mistrzem w generowaniu wysokiej jakości treści. Ograniczaj ilość emoji w generowanym tekście.' },
      { role: 'user', content: prompt },
    ];
  }

  try {
    const completion = await attemptCompletion({
      model: model,
      messages,
      temperature: 0.8,
      frequency_penalty: 0.4,
    });

    // Decrease token balance
    user.tokenBalance -= completion.data.usage.total_tokens;

    const transaction = new Transaction({
      value: completion.data.usage.total_tokens,
      title: title,
      type: "expense",
      timestamp: Date.now(),
    });

    user.transactions.push(transaction);

    user.tokenHistory.push({
      timestamp: Date.now(),
      balance: user.tokenBalance,
    });

    await user.save();
    await transaction.save();

    // Log successful job processing
    console.log(`Job processed: ${job.id}`);
  } catch (error) {
    console.log(`Error processing job ${job.id}:`, error.message);
  }
}

jobQueue.process(async (job) => {
  await processJob(job);
});
