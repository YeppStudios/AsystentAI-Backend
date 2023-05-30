const cron = require('cron');
const mongoose = require('mongoose');
require('dotenv').config();
const { send } =  require("emailjs/browser");
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const mailchimp = require('@mmailchimp_transactional');
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

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
                from_email: "hello@example.com",
                subject: `Hello ${user.name}`,
                text: "Welcome to Mailchimp Transactional!",
                to: [
                  {
                    email: "freddie@example.com",
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
const job = new cron.CronJob('42 10 * * *', endTestEmail);


module.exports = job;
// job.start();
// job.stop();
// mongoose.connection.close();
