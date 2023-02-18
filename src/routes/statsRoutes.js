const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const requireAuth = require('../middlewares/requireAuth');

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

router.get('/stats/:userId', async (req, res) => {
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
  
module.exports = router;