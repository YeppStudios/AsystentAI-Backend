const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAdmin = require('../middlewares/requireAdmin');
const User = mongoose.model('User');
const Profile = mongoose.model('Profile');
const requireAuth = require("../middlewares/requireAuth");


// Get profiles for user
router.get('/getProfiles', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('profiles');
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
      }
  });
  
// Get profile by ID for user
router.get('/getProfile/:profileId', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const profileId = req.params.profileId;
      const profile = await Profile.findById(profileId);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      res.json(profile);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server Error' });
    }
  });
  

// Add new profile for user
router.post('/addProfile', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const newProfile = new Profile(req.body);
    user.profiles.push(newProfile);
    await user.save();
    await newProfile.save();
    const userWithProfiles = await User.findById(req.user._id).populate('profiles');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(userWithProfiles.profiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update user profile by id
router.patch('/updateProfile/:profileId', requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const profile = await Profile.findById(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      if (req.body.targetAudience) {
        profile.targetAudience = req.body.targetAudience;
      }
      if (req.body.background) {
        profile.background = req.body.background;
      }
      if (req.body.goals) {
        profile.goals = req.body.goals;
      }
      if (req.body.values) {
        profile.values = req.body.values;
      }
      if (req.body.advantages) {
        profile.advantages = req.body.advantages;
      }
      if (req.body.image) {
        profile.image = req.body.image;
      }
      if (req.body.name) {
        profile.name = req.body.name;
      }
  
      await user.save();
      await profile.save();

      res.json(profile);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server Error' });
    }
  });
  

// Delete profile for user
router.delete('/deleteProfile', requireAuth, async (req, res) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profiles.id(req.params.profileId).remove();
    await user.save();

    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
