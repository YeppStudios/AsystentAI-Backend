const cron = require('cron');
const mongoose = require('mongoose');
require('dotenv').config();
const { send } =  require("emailjs/browser");
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const mailchimp = require('mmailchimp_transactional')(process.env.MAILCHIMP_TRANSACTIONAL_API_KEY);

//add tokens for users with plans every month
const endTestEmail = async () => {
    let fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 5);
    let fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 6);
    User.find({ email: "gerke.contact@gmail.com" }, (err, users) => {
        if (err) console.log(err);

        users.forEach(async user => {
            const message = {
                from_email: "hello@asystent.ai",
                subject: `Hello ${user.name}`,
                text: "Welcome to Mailchimp Transactional!",
                to: [
                  {
                    email: user.email,
                    type: "to"
                  }
                ]
              };
            user.isBlocked = true;
            await mailchimp.messages.send({
                message
            });
        });
    });
};
const job = new cron.CronJob('50 10 * * *', endTestEmail);


module.exports = job;
// job.start();
// job.stop();
// mongoose.connection.close();
