// const cron = require('cron');
// const mongoose = require('mongoose');
// require('dotenv').config();
// const User = mongoose.model('User');
// const Plan = mongoose.model('Plan');

// const mongoUri = process.env.MONGO_URI;
// mongoose.connect(mongoUri);

// //add tokens for users with plans every month
// const monthlyTokenRefill = async () => {
//     const users = await User.find({});
//     const promises = users.map(async user => {
//         try {
//             const plan = await Plan.findById(user.plan);
//             const amount = plan.monthlyTokens;
//             const purchase = {
//                 price: plan.price,
//                 tokens: amount,
//                 title: "Doładowanie elixiru",
//                 type: "recurring"
//             }
//             user.purchases.push(purchase);
//             user.tokenBalance += amount;
//             const balanceSnapshot = {
//                 timestamp: new Date(),
//                 balance: user.tokenBalance
//             };
//             user.tokenHistory.balanceHistory.push(balanceSnapshot);
//             await user.save();
//         } catch (e) {
            
//         }
//     });
//     await Promise.all(promises);
// };
// const job = new cron.CronJob('0 0 1 * *', monthlyTokenRefill);


// module.exports = job;
// // job.start();
// // job.stop();
// // mongoose.connection.close();
