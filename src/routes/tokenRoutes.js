const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');


router.get('/balance/:userId', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        return res.json({ balance: user.tokenBalance });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put('/:userId/deduct', requireAdmin, async (req, res) => {
    try {
        const { amount, title } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        if (amount > user.tokenBalance) {
            return res.status(400).json({ message: 'Insufficient token balance' });
        }
        // Create a new transaction for the expense
        const transaction = new Transaction({
            value: amount,
            title: title,
            type: "expense",
            timestamp: Date.now()
        });

        // Add the new transaction to the user's transactions
        user.transactions.push(transaction);
        user.tokenBalance -= amount;

        // Create a new balance snapshot and add it to the user's tokenHistory
        const balanceSnapshot = {
            timestamp: new Date(),
            balance: user.tokenBalance
        };
        user.tokenHistory.push(balanceSnapshot);

        // Save the user
        await user.save();
        return res.json({ balance: user.tokenBalance });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.patch('/users/:userId/addTokens', requireAdmin, async (req, res) => {
    try {
        const { amount, title } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const transaction = new Transaction({
            value: amount,
            title: title,
            type: "income",
            timestamp: Date.now()
        });

        user.transactions.push(transaction);

        // Add the new purchase to the user's purchases
        user.tokenBalance += amount;

        // Create a new balance snapshot and add it to the user's tokenHistory
        const balanceSnapshot = {
            timestamp: new Date(),
            balance: user.tokenBalance
        };
        user.tokenHistory.push(balanceSnapshot);

        // Save the user
        await user.save();
        await transaction.save();
        return res.json({ balance: user.tokenBalance });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/token-history/:userId', requireAuth, (req, res) => {
    User.findById(req.params.userId)
        .populate({
            path: 'tokenHistory',
            populate: {
                path: 'transactions'
            }
        })
        .exec((err, user) => {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).json(user.tokenHistory);
            }
        });
});

router.get('/token-transactions/:userId', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate({
            path: 'transactions',
            options: { sort: { timestamp: -1 } }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json(user.transactions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/transactions/:transactionId', requireAuth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.transactionId);
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        return res.json(transaction);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.get('/:userId/planInfo', async (req, res) => {
    try {
      // Get the user by id
      const user = await User.findById(req.params.userId);
      if(!user){
        return res.status(404).json({ message: 'User not found' });
      }
      // Find the plan by id stored in the "plan" field of the User model
      const plan = await Plan.findById(user.plan);

      if(!plan){
        return res.status(404).json({ message: 'Plan not found' });
      }
      // Calculate the percentage of available tokens
      let percentage = 0;
      if (user.tokenBalance > 0) {
        percentage = (user.tokenBalance / plan.monthlyTokens).toFixed(4);
        percentage = percentage > 1 ? 1 : percentage;
      }
  
      // Return the percentage
      return res.json({ percentage, balance: user.tokenBalance, plan: plan });
    } catch (err) {
      // If there's an error, return a 500 status code and the error message
      return res.status(500).json({ message: err.message });
    }
  });

  router.patch('/addTestTokens/:userId', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;
  
    try {
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      user.testTokenBalance += amount;
  
      await user.save();
  
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  

module.exports = router;