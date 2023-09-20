const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Transaction = mongoose.model('Transaction');
const OnboardingSurveyData = mongoose.model('OnboardingSurveyData');
const CompanyLogin = mongoose.model('CompanyLogin');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();

router.get('/purchase-history/:userId', requireAuth, (req, res) => {
    User.findById(req.params.userId)
        .populate('purchases')
        .exec((err, user) => {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).json(user.purchases);
            }
        });
});

router.get('/stats/:userId', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      const { totalPosts, totalEmails, totalIdeas } = user.stats;
      res.status(200).json({
        totalPosts,
        totalEmails,
        totalIdeas,
      });
    } catch (error) {
      res.status(500).send(error);
    }
  });

router.post('/user/:userId/addPosts', requireAuth, (req, res) => {
    const userId = req.params.userId;
    const postsToAdd = req.body.postsToAdd;
  
    User.findByIdAndUpdate(userId, { $inc: { 'stats.totalPosts': postsToAdd } }, { new: true }, (err, updatedUser) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).json(updatedUser.stats);
      }
    });
  });
  
  router.post('/user/:userId/addEmails', requireAuth, (req, res) => {
    const userId = req.params.userId;
    const emailsToAdd = req.body.emailsToAdd;
  
    User.findByIdAndUpdate(userId, { $inc: { 'stats.totalEmails': emailsToAdd } }, { new: true }, (err, updatedUser) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).json(updatedUser.stats);
      }
    });
  });
  
  router.post('/user/:userId/addIdeas', requireAuth, (req, res) => {
    const userId = req.params.userId;
    const ideasToAdd = req.body.ideasToAdd;
  
    User.findByIdAndUpdate(userId, { $inc: { 'stats.totalIdeas': ideasToAdd } }, { new: true }, (err, updatedUser) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).json(updatedUser.stats);
      }
    });
  });

  router.post('/count-individual-transactions', requireAdmin, async (req, res) => { // Changed to POST
    try {
      const { start, end } = req.body;
  
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
  
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
  
      const transactionsInRange = await Transaction.aggregate([
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: '$user',
            count: { $sum: 1 },
          },
        },
      ]);
  
      res.json(transactionsInRange);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving transactions.' });
    }
  });
  
  router.post('/count-cumulative-transactions', requireAdmin, async (req, res) => {
    try {
      const { start, end } = req.body;
  
      const startDate = start ? new Date(start) : null;
      if (startDate) {
        startDate.setHours(0, 0, 0, 0);
      }
  
      const endDate = end ? new Date(end) : null;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
  
      const matchStage = {
        $match: {
          timestamp: {},
        },
      };
  
      if (startDate) {
        matchStage.$match.timestamp.$gte = startDate;
      }
  
      if (endDate) {
        matchStage.$match.timestamp.$lt = endDate;
      }
  
      const cumulativeTransactions = await Transaction.aggregate([
        matchStage,
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]);
  
      res.json(cumulativeTransactions);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving cumulative transactions.' });
      console.log(error)
    }
  });
  


  router.post('/count-individual-tokens', requireAdmin, async (req, res) => { // Changed to POST
    try {
      const { start, end } = req.body;
  
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
  
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
  
      const transactionsInRange = await Transaction.aggregate([
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: '$user',
            count: { $sum: 1 },
          },
        },
      ]);
  
      res.json(transactionsInRange);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving transactions.' });
    }
  });
  
  router.post('/count-cumulative-tokens', requireAdmin, async (req, res) => {
    try {
      const { start, end } = req.body;
  
      const startDate = start ? new Date(start) : null;
      if (startDate) {
        startDate.setHours(0, 0, 0, 0);
      }
  
      const endDate = end ? new Date(end) : null;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
  
      const matchStage = {
        $match: {
          timestamp: {},
        },
      };
  
      if (startDate) {
        matchStage.$match.timestamp.$gte = startDate;
      }
  
      if (endDate) {
        matchStage.$match.timestamp.$lt = endDate;
      }
  
      const cumulativeTransactions = await Transaction.aggregate([
        matchStage,
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]);
  
      res.json(cumulativeTransactions);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving cumulative transactions.' });
      console.log(error)
    }
  });
  
  router.post('/transactions-last-7-days', requireAdmin, async (req, res) => {
    try {
      // Get the current date
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
  
      // Calculate the date 7 days ago
      const sevenDaysAgo = new Date(currentDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
      // Aggregate transactions by day
      const transactionsByDay = await Transaction.aggregate([
        {
          $match: {
            timestamp: {
              $gte: sevenDaysAgo,
              $lt: currentDate,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
  
      res.json(transactionsByDay);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving transactions for the last 7 days.' });
      console.log(error);
    }
  });
  
  //GET /avg-transactions?year=2023&month=8
  //Avg. number of transactions per month for user who have a plan and were created before the specified month
  router.get('/avg-transactions', async (req, res) => {
    try {
        const trackingMonth = new Date(req.query.year, req.query.month - 1);
        const nextMonth = new Date(trackingMonth.getFullYear(), trackingMonth.getMonth() + 1, 1);

        const pipeline = [
            {
                $match: {
                    createdAt: { $lt: trackingMonth },
                    plan: { $ne: null, $ne: mongoose.Types.ObjectId('647c3294ff40f15b5f6796bf') }
                }
            },
            {
                $lookup: {
                    from: 'transactions',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'transactionData'
                }
            },
            {
                $unwind: "$transactionData"
            },
            {
                $match: {
                    "transactionData.timestamp": { $gte: trackingMonth, $lt: nextMonth }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    monthlyTransactions: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgTransactions: { $avg: "$monthlyTransactions" }
                }
            }
        ];

        const result = await User.aggregate(pipeline);
        const avgTransactions = result[0]?.avgTransactions || 0;

        res.json({ avgTransactions });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// GET /active-paid-monthly?year=2023&month=8
router.get('/active-paid-monthly', async (req, res) => {
  try {
      const year = parseInt(req.query.year);
      const month = parseInt(req.query.month) - 1; // 0-based month

      // Calculate start date of the month
      const trackingMonthStart = new Date(year, month, 1);

      // Calculate end date of the month (first day of the next month)
      const trackingMonthEnd = new Date(year, month + 1, 1);

      // Aggregation pipeline
      const pipeline = [
          {
              $match: {
                  timestamp: { $gte: trackingMonthStart, $lt: trackingMonthEnd }
              }
          },
          {
              $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'userData'
              }
          },
          {
              $unwind: "$userData"
          },
          {
              $match: {
                  "userData.createdAt": { $lt: trackingMonthStart },
                  "userData.plan": { $ne: null, $ne: mongoose.Types.ObjectId('647c3294ff40f15b5f6796bf') }
              }
          },
          {
              $group: {
                  _id: "$userData._id"
              }
          },
          {
              $count: "seenUsersCount"
          }
      ];

      const result = await Transaction.aggregate(pipeline); // Start from the Transaction model
      const seenUsersCount = result[0]?.seenUsersCount || 0;

      res.json({ seenUsersCount });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET /avg-tokens-monthly?year=2023&month=8
router.get('/avg-tokens-monthly', async (req, res) => {
  try {
      const year = parseInt(req.query.year);
      const month = parseInt(req.query.month) - 1; // 0-based month

      // Calculate start date of the month
      const trackingMonthStart = new Date(year, month, 1);

      // Calculate end date of the month (first day of the next month)
      const trackingMonthEnd = new Date(year, month + 1, 1);

      // Aggregation pipeline
      const pipeline = [
          {
              $match: {
                  timestamp: { $gte: trackingMonthStart, $lt: trackingMonthEnd }
              }
          },
          {
              $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'userData'
              }
          },
          {
              $unwind: "$userData"
          },
          {
              $match: {
                  "userData.createdAt": { $lt: trackingMonthStart },
                  "userData.plan": { $ne: null, $ne: mongoose.Types.ObjectId('647c3294ff40f15b5f6796bf') }
              }
          },
          {
              $group: {
                  _id: "$userData._id",
                  totalTokens: { $sum: "$value" }
              }
          },
          {
              $group: {
                  _id: null,
                  avgTokens: { $avg: "$totalTokens" }
              }
          }
      ];

      const result = await Transaction.aggregate(pipeline); // Start from the Transaction model
      const avgTokens = result[0]?.avgTokens || 0;

      res.json({ avgTokens });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});




  router.get('/getOnboardingSurveyData', requireAdmin, async (req, res) => {
    try {
        const data = await OnboardingSurveyData.find();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
  });
  
  router.get('/unique-company-logins', async (req, res) => {
    try {
        const year = new Date().getFullYear(); // assuming current year; adjust as needed
        const month = parseInt(req.query.month) - 1; // 0-based month

        // Calculate start date of the month
        const monthStart = new Date(year, month, 1);

        // Calculate end date of the month (first day of the next month)
        const monthEnd = new Date(year, month + 1, 1);

        // Use MongoDB's aggregation framework to get unique workspaceIds
        const uniqueLogins = await CompanyLogin.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: monthStart,
                        $lt: monthEnd
                    }
                }
            },
            {
                $group: {
                    _id: '$workspaceId',
                }
            }
        ]);

        // Calculate the number of unique logins
        const uniqueLoginCount = uniqueLogins.length;

        // Send the number of unique logins
        res.json({ uniqueLoginCount: uniqueLoginCount });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});


  

module.exports = router;