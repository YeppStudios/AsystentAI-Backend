const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAdmin = require('../middlewares/requireAdmin');
const requireAuth = require('../middlewares/requireAuth');
const Plan = mongoose.model('Plan');
const User = mongoose.model('User');
const Transaction = mongoose.model('Transaction');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);


router.get('/getPlans', requireAdmin, async (req, res) => {
    try {
        const plans = await Plan.find();
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/getPlan/:id', requireAuth, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        return res.json(plan);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post('/createPlan', requireAdmin, async (req, res) => {
    try {
        const { name, monthlyTokens, price, maxFiles, maxUploadedBytes, maxAssistants } = req.body;
        const plan = new Plan({ name, monthlyTokens, price, maxFiles, maxUploadedBytes, maxAssistants});

        await plan.save();
        res.status(201).json(plan);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//allow only admin to update the plan
router.patch('/updatePlan/:id', requireAdmin, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        const { name, monthlyTokens, price, maxFiles, maxUploadedBytes, maxAssistants, priceId, maxFolders } = req.body;
        if (name) {
            plan.name = name;
        }
        if (monthlyTokens) {
            plan.monthlyTokens = monthlyTokens;
        }
        if (price) {
            plan.price = price;
        }

        if (maxUploadedBytes !== undefined) {
            plan.maxUploadedBytes = maxUploadedBytes;
        }

        if (maxFiles !== undefined) {
            plan.maxFiles = maxFiles;
        }

        if (maxFolders !== undefined) {
            plan.maxFolders = maxFolders;
        }

        if (maxAssistants !== undefined) {
            plan.maxAssistants = maxAssistants;
        }

        if (priceId) {
            plan.priceId = priceId;
        }

        await plan.save();
        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



//allow only admin to delete the plan
router.delete('/deletePlan/:id', requireAdmin, async (req, res) => {
    try {
        const deletedPlan = await Plan.findByIdAndDelete(req.params.id);
        if (!deletedPlan) return res.status(404).json({ message: 'Plan not found' });
        return res.json({ message: 'Plan deleted' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.patch('/updateUserPlan/:userId', requireAdmin, async (req, res) => {

    try {
        const plan = await Plan.findById(req.body.planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const update = {
            plan: req.body.planId,
            // Set default token balance if not provided
            tokenBalance: req.body.tokens || plan.monthlyTokens,
        };

        const user = await User.findOneAndUpdate(
            { _id: req.params.userId },
            { $set: update },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        try {
            User.findByIdAndUpdate(req.params.userId, { $set: { plan: req.body.planId } }, { new: true }, async (err, user) => {
                if (err) {
                    return res.status(500).send(err);
                }
        
                 // Create a new transaction
                 const transaction = new Transaction({
                    value: plan.monthlyTokens,
                    title: `Subscription activated ${plan.name}`,
                    type: 'income',
                    timestamp: Date.now()
                });
                // user.transactions.push(transaction);
                // if (plan.monthlyTokens !== req.body.tokens) {
                //     user.tokenBalance = req.body.tokens;
                //     user.monthlyTokens = req.body.tokens;
                // } else {
                //     user.tokenBalance = plan.monthlyTokens;
                // }
                // const balanceSnapshot = {
                //     timestamp: Date.now(),
                //     balance: user.tokenBalance
                // };
                // user.tokenHistory.push(balanceSnapshot);
        
                await user.save();
                await transaction.save();
                return res.json(user);
            });
        } catch (e) {
            return res.status(500).json({ message: error.message });
        }
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
    
});


//write an endpoint to send an email using sendgrid
router.post('/sendPaymentFailedEmail', requireAdmin, async (req, res) => {
    try {
        const { email, name } = req.body;
        const msg = {
            to: `${email}`,
            from: 'hello@asystent.ai',
            templateId: 'd-555679e4d7c248d6ac8bf1da521a17c8',
            dynamicTemplateData: {
            name: `${name}`,
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
        res.json({ message: 'Email sent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});




module.exports = router;