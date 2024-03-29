const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAdmin = require('../middlewares/requireAdmin');
const User = mongoose.model('User');
const Profile = mongoose.model('Profile');
const requireAuth = require("../middlewares/requireAuth");

router.get('/getProfiles', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const profiles = await Profile.find({ workspace: user.workspace });
        return res.json(profiles);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server Error' });
      }
  });
  

  router.get('/getProfile/:profileId', requireAuth, async (req, res) => {
    try {
        const profileId = req.params.profileId;
        const profile = await Profile.findById(profileId)
            .populate({
                path: 'subfolders',
                populate: {
                    path: 'owner',
                    model: 'User'
                }
            });

        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        return res.json(profile);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server Error' });
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
    await newProfile.save();
    return res.json(newProfile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


router.patch('/updateProfile/:profileId', requireAuth, async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      if ( req.body.title ) {
        profile.title = req.body.title;
      }

      if ( req.body.workspace ) {
        profile.workspace = req.body.workspace;
      }

      if (req.body.imageUrl) {
        profile.imageUrl = req.body.imageUrl;
      }

      if (req.body.description) {
        profile.description = req.body.description;
      }

      await profile.save();

      return res.json(profile);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server Error' });
    }
  });
  

  router.delete('/delete_profile/:profileId', async (req, res) => {
    const { profileId } = req.params;
  
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }
  
    try {
      const deletedProfile = await Profile.findByIdAndDelete(profileId);
  
      if (!deletedProfile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
  
      return res.json({ message: 'Profile successfully deleted' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

module.exports = router;
