const cron = require('cron');
const mongoose = require('mongoose');
require('dotenv').config();
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);

//add tokens for users with plans every month
const endTestEmail = async () => {
    let fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    fiveDaysAgo.setHours(0, 0, 0, 0);
    
    let sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    sixDaysAgo.setHours(23, 59, 59, 999);

    // Fetch users who registered between 5 and 6 days ago
    User.find({ createdAt: { $gte: sixDaysAgo, $lte: fiveDaysAgo } }, (err, users) => {
        if (err) console.log(err);

        users.forEach(async user => {
            if(user.tokenBalance !== 0 && user.plan ==="647c3294ff40f15b5f6796bf") {
                const msg = {
                    to: `${user.email}`,
                    from: 'hello@asystent.ai',
                    templateId: 'd-3daf3c4290f04a54b4f91753b681c5c6',
                    dynamicTemplateData: {
                    name: `${user.name}`,
                    link: `https://www.asystent.ai/pricing`
                    },
                };
                
                sgMail
                    .send(msg)
                    .then(() => {
                    })
                    .catch((error) => {
                    console.error(error)
                    });

                user.tokenBalance = 0;
                await user.save();
            }
        });
    });
};

const blockExpiredSubscriptions = async () => {
    const now = new Date();

    // Fetch users whose subscriptions have expired and are not blocked yet
    const usersToBlock = await User.find({ 
        subscriptionEndDate: { $lt: now },
        isBlocked: false
    });

    for (const user of usersToBlock) {
        user.isBlocked = true;
        await user.save();
    }
}

const emailJob = new cron.CronJob('30 7 * * *', endTestEmail);
const blockSubscriptionsJob = new cron.CronJob('00 12 * * *', blockExpiredSubscriptions);

module.exports = {
    emailJob,
    blockSubscriptionsJob
};
// job.start();
// job.stop();
// mongoose.connection.close();
