const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();


// Get all users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find();
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// Get a single user
router.get('/users/:id', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// Update a user
router.patch('/updateUser/:id', requireAdmin, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json(updatedUser);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.patch('/unblockUser/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = false;
    await user.save();

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/newUsersCount', requireAdmin, async (req, res) => {
  try {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 7);

      const count = await User.countDocuments({
          createdAt: {
              $gte: fiveDaysAgo
          }
      });

      res.json({ count });
  } catch(err) {
      console.error(err);
      res.status(500).send('Server Error');
  }
});

router.post('/addOnboardingData', requireAuth, async (req, res) => {
  try {
      const { industry, role, companySize, hasUsedAI } = req.body;
      const user = req.user._id;
      
      // create new onboarding data object
      const newOnboardingData = new OnboardingSruveyData({
          user,
          industry,
          role,
          companySize,
          hasUsedAI,
      });

      // save the new onboarding data to the database
      const savedOnboardingData = await newOnboardingData.save();

      // send back the saved onboarding data
      res.status(201).json(savedOnboardingData);
  } catch (err) {
      // send error message if there is any
      res.status(500).json({ error: err.message });
  }
});


router.patch('/updateUserData/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { contactEmail, profilePicture, fullName, street, apartmentNumber, companyName, nip, city, postalCode, accountType, name, workspace } = req.body;
    
    try {
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (postalCode) {
        user.postalCode = postalCode;
      }

      if (accountType) {
        user.accountType = accountType;
      }

      if (city) {
        user.city = city;
      }
      
      if (contactEmail) {
        user.contactEmail = contactEmail;
      }

      if (fullName) {
        user.fullName = fullName;
      }

      if (apartmentNumber) {
        user.apartmentNumber = apartmentNumber;
      }
      
      if (profilePicture) {
        user.profilePicture = profilePicture;
      }

      if (name) {
        user.name = name;
      }

      if (street) {
        user.street = street;
      }

      if (workspace) {
        user.workspace = workspace;
      }
      
      if (companyName) {
        user.companyName = companyName;
      }
      
      if (nip) {
        user.nip = nip;
      }
      
      const updatedUser = await user.save();
      
      res.json(updatedUser);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  
// Delete a user
router.delete('/deleteUser/:id', requireAuth, async (req, res) => {
    try {
        if((req.user._id).toString() === req.params.id || req.user.appAdmin){
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json({ message: 'User deleted' });
        } else {
            return res.status(401).json({ message: 'You cannot delete this user' });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// Get user refferal link
router.get('/get-refferal-link', requireAuth, async (req, res) => {
  const user = req.user;
  try {
    const refferalLink = `https://asystent.ai/marketing?registration=true&ref=${user._id}`;
    return res.status(200).json({ link: refferalLink });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});


router.put('/clear-referred-by', requireAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { referredBy: "" } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'ReferredBy field cleared successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/getEmails', requireAdmin, async (req, res) => {
  try {
      // 4. Query the MongoDB database to fetch all users and return only their email addresses
      const emailList = await User.find({}, 'email'); // project only the email field

      // 5. Send the response as an array of email addresses
      res.status(200).json(emailList.map(user => user.email));
  } catch (err) {
      res.status(500).json({ message: 'An error occurred while fetching email addresses', error: err.message });
  }
});

router.put('/displayElixirInfo', requireAuth, async (req, res) => {
  const userId = req.user._id;

  try {
      const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: { elixirAware: true } },
          { new: true }
      );

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User elixir aware', user: updatedUser });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error updating user reminder state' });
  }
});

router.post('/last-user-emails', requireAdmin, async (req, res) => {
  try {
    const emailsNumber = req.body.emailsNumber;
    if (typeof emailsNumber !== 'number' || emailsNumber <= 0) {
      return res.status(400).json({ message: 'Invalid value for emailsNumber' });
    }
    
    const users = await User.find().sort({ createdAt: -1 }).limit(emailsNumber).select('email name');
    const userInfos = users.map(user => ({ email: user.email, name: user.name }));
    res.status(200).json({ users: userInfos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;