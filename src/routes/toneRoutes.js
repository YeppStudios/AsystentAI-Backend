const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const Tone = mongoose.model('Tone');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);


router.get('/tones', requireAuth, async (req, res) => {
    try {
        const tones = await Tone.find();
        res.status(200).send(tones);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/tones/owner', requireAuth, async (req, res) => {
    try {
        // Assuming `req.user._id` contains the ID of the logged-in user
        const ownerId = req.user._id.toString();
        
        const tones = await Tone.find({ owner: ownerId });
        res.status(200).send(tones);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/tone/:id', requireAuth, async (req, res) => {
    try {
        const tone = await Tone.findById(req.params.id);
        if (!tone) return res.status(404).send();
        res.status(200).send(tone);
    } catch (error) {
        res.status(500).send(error);
    }
});


router.put('/tone/:id', requireAuth, async (req, res) => {
    try {
        const tone = await Tone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!tone) return res.status(404).send();
        res.status(200).send(tone);
    } catch (error) {
        res.status(400).send(error);
    }
});


router.delete('/tone/:id', requireAuth, async (req, res) => {
    try {
        const tone = await Tone.findByIdAndDelete(req.params.id);
        if (!tone) return res.status(404).send();
        res.status(200).send(tone);
    } catch (error) {
        res.status(500).send(error);
    }
});


module.exports = router;