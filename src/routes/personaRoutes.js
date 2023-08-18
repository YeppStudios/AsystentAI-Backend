const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const Persona = mongoose.model('Persona');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);


router.post('/persona', requireAuth, async (req, res) => {
    try {
        const persona = new Persona(req.body);
        await persona.save();
        res.status(201).send(persona);
    } catch (error) {
        res.status(400).send(error);
    }
});

router.get('/personas', requireAuth, async (req, res) => {
    try {
        const personas = await Persona.find();
        res.status(200).send(personas);
    } catch (error) {
        res.status(500).send(error);
    }
});


router.get('/personas/owner', requireAuth, async (req, res) => {
    try {
        const ownerId = req.user._id.toString();
        const personas = await Persona.find({ owner: ownerId });
        res.status(200).send(personas);
    } catch (error) {
        res.status(500).send(error);
    }
});


router.get('/persona/:id', requireAuth, async (req, res) => {
    try {
        const persona = await Persona.findById(req.params.id);
        if (!persona) return res.status(404).send();
        res.status(200).send(persona);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.put('/persona/:id', requireAuth, async (req, res) => {
    try {
        const persona = await Persona.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!persona) return res.status(404).send();
        res.status(200).send(persona);
    } catch (error) {
        res.status(400).send(error);
    }
});

router.delete('/persona/:id', requireAuth, async (req, res) => {
    try {
        const persona = await Persona.findByIdAndDelete(req.params.id);
        if (!persona) return res.status(404).send();
        res.status(200).send(persona);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;