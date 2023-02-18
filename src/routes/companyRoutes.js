const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const User = mongoose.model('User');

router.post('/create-employee', async (req, res) => {
    const { name, email, role } = req.body;
    const company = req.user.company;

    try {
        const user = new User({
            name,
            email,
            accountType: 'employee',
            company
        });

        await user.save();
        // send invitation email using nodemailer
        res.status(201).json({ message: 'Employee profile created successfully' });
    } catch (err) {
        res.status(400).json({ message: 'Failed to create employee profile' });
    }
});

//delete employee 

//get employees and number of tokens they've used

module.exports = router;