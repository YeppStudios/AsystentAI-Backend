const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin')
const Tone = mongoose.model('Tone');
const Workspace = mongoose.model('Workspace');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);

router.post('/save-tone', requireAuth, async (req, res) => {
    const { title, icon, prompt, workspace, base_text, profile } = req.body;

    if (!title || !prompt || !workspace) {
        return res.status(400).send({ error: 'All fields are required' });
    }

    try {
        const workspaceExists = await Workspace.findById(workspace);

        if ( !workspaceExists) {
            return res.status(400).send({ error: 'Invalid workspace' });
        }

        const newTone = new Tone({
            title,
            icon: icon || "https://storage.googleapis.com/socialmedia-images-yepp/tone_default.png",
            prompt,
            owner: req.user._id,
            workspace,
            base_text,
            profile
        });

        await newTone.save();

        res.status(201).send(newTone);

    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


router.get('/tones', requireAdmin, async (req, res) => {
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
        return res.status(200).send(tones);
    } catch (error) {
        return res.status(500).send(error);
    }
});

router.get('/profile_tones/:profileId', requireAuth, async (req, res) => {
    try {
        const tones = await Tone.find({ profile: req.params.profileId });
        return res.status(200).send(tones);
    } catch (error) {
        return res.status(500).send(error);
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