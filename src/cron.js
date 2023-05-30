const cron = require('cron');
const mongoose = require('mongoose');
require('dotenv').config();
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);

//add tokens for users with plans every month
const endTestEmail = async () => {
    let fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 5);
    let fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 6);
    User.find({ email: "gerke.contact@gmail.com" }, (err, users) => {
        if (err) console.log(err);

        users.forEach(async user => {
            const msg = {
                to: `${user.email}`,
                from: 'hello@asystent.ai',
                templateId: 'd-fe65c7fe87f14c358079b6e48d97ff36',
                dynamicTemplateData: {
                  name: `${user.name}`, // this will replace {{firstName}} in your template
                },
              };
              
            sgMail
                .send(msg)
                .then(() => {
                })
                .catch((error) => {
                  console.error(error)
                });

            user.isBlocked = true;
        });
    });
};
const job = new cron.CronJob('4 14 * * *', endTestEmail);


module.exports = job;
// job.start();
// job.stop();
// mongoose.connection.close();
