const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();


// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// Get a single user
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
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


// Delete a user
router.delete('/deleteUser/:id', requireAuth, async (req, res) => {
    try {
        if(req.user._id === req.params.id || req.user.appAdmin){
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


module.exports = router;