const express = require('express');
const mongoose = require('mongoose');
const Whitelist = mongoose.model('Whitelist');
const User = mongoose.model('User');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();


router.get('/whitelist', async (req, res) => {
    try {
        const whitelist = await Whitelist.find();
        return res.status(200).json(whitelist);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post('/whitelist/add', async (req, res) => {
    try {
        const { code, hours } = req.body;
        const expireAt = new Date();
        expireAt.setHours(expireAt.getHours() + Number(hours));
        const whitelist = new Whitelist({ code, expireAt });

        await whitelist.save();
        res.status(201).json(whitelist);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.delete('/whitelist/delete/:id', requireAdmin, async (req, res) => {
    try {
        const deletedEmail = await Whitelist.findByIdAndDelete(req.params.id);
        if (!deletedEmail) return res.status(404).json({ message: 'Spot not found' });
        return res.json({ message: 'Email deleted' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/whitelist/check/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const record = await Whitelist.findOne({ code: code });
        if (record && new Date(record.expireAt) > new Date()) {
            res.status(200).json({ valid: true });
        } else {
            res.status(200).json({ valid: false });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
