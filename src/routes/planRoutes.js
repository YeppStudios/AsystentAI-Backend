const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireTester = require('../middlewares/requireTester');
const requireAdmin = require('../middlewares/requireAdmin');
const Plan = mongoose.model('Plan');
const User = mongoose.model('User');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');

router.get('/getPlans', async (req, res) => {
    try {
        const plans = await Plan.find();
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/getPlan/:id', async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/createPlan', requireAdmin, async (req, res) => {
    try {
        const { name, monthlyTokens, price, maxProfiles } = req.body;
        const plan = new Plan({ name, monthlyTokens, price, maxProfiles });

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
        const { name, monthlyTokens, price, maxProfiles } = req.body;
        if (name) {
            plan.name = name;
        }
        if (monthlyTokens) {
            plan.monthlyTokens = monthlyTokens;
        }
        if (price) {
            plan.price = price;
        }
        if(maxProfiles){
            plan.maxProfiles = maxProfiles;
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

    const plan = await Plan.findById(req.body.planId);

    if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
    }
    try {
        User.findByIdAndUpdate(req.params.userId, { $set: { plan: req.body.planId } }, { new: true }, async (err, user) => {
            if (err) {
                return res.status(500).send(err);
            }
    
             // Create a new transaction
             const transaction = new Transaction({
                value: plan.monthlyTokens,
                title: `Aktywacja subskrypcji ${plan.name}`,
                type: 'income',
                timestamp: Date.now()
            });
            user.transactions.push(transaction);
    
            user.tokenBalance = plan.monthlyTokens;
    
            const balanceSnapshot = {
                timestamp: Date.now(),
                balance: user.tokenBalance
            };
            user.tokenHistory.push(balanceSnapshot);
    
            await user.save();
            await transaction.save();
            return res.json(user);
        });
    } catch (e) {
        return res.status(500).json({ message: error.message });
    }
});


module.exports = router;