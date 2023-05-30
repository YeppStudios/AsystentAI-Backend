const cron = require('cron');
const mongoose = require('mongoose');
require('dotenv').config();
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');

const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);

//add tokens for users with plans every month
const endTestEmail = async () => {
    let fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 5);
    let fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 6);
    User.find({ email: "gerke.contact@gmail.com" }, (err, users) => {
        if (err) console.log(err);

        users.forEach(user => {
            user.isBlocked = true;
            let link = "https://www.asystent.ai";
            if (user.accountType === "company") {
                link = "https://www.asystent.ai/order/assistantbusiness";
            } else {
                link = "https://www.asystent.ai/pricing?type=individual"
            }
            const templateParams = {
                email: `gerke.contact@gmail.com`,
                name: `${user.name}`,
                link: `${link}`
            };
            send("service_5j2yxyh","template_9kinxdy", templateParams, process.env.EMAILJS_USER_KEY);
        });
    });
};
const job = new cron.CronJob('30 9 * * *', endTestEmail);


module.exports = job;
// job.start();
// job.stop();
// mongoose.connection.close();
