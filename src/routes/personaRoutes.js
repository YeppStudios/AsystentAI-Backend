const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin')
const Persona = mongoose.model('Persona');
const sgMail = require('@sendgrid/mail');
const Workspace = mongoose.model('Workspace');
sgMail.setApiKey(process.env.SENDGRID_KEY);


router.post('/save-persona', requireAuth, async (req, res) => {
    const { title, icon, prompt, workspace, base_text, profile } = req.body;

    if (!title || !icon || !prompt || !workspace) {
        return res.status(400).send({ error: 'All fields are required' });
    }

    try {
        const workspaceExists = await Workspace.findById(workspace);

        if (!workspaceExists) {
            return res.status(400).send({ error: 'Invalid workspace' });
        }

        const newPersona = new Persona({
            title,
            icon,
            prompt,
            owner: req.user._id,
            workspace,
            base_text: base_text,
            profile
        });

        await newPersona.save();
        return res.status(201).send(newPersona);

    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Internal Server Error' });
    }
});


router.get('/personas', requireAdmin, async (req, res) => {
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
        return res.status(200).send(personas);
    } catch (error) {
        return res.status(500).send(error);
    }
});

router.get('/profile_personas/:profileId', requireAuth, async (req, res) => {
    try {
        const personas = await Persona.find({ profile: req.params.profileId });
        return res.status(200).send(personas);
    } catch (error) {
        return res.status(500).send(error);
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


router.patch('/assign_profile_to_persona/:personaId', async (req, res) => {
    const personaId = req.params.personaId;
    const { profileId } = req.body;
  
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }
  
    try {
      const persona = await Persona.findByIdAndUpdate(
        personaId,
        { $set: { profile: profileId } },
        { new: true }
      );
  
      if (!persona) {
        return res.status(404).json({ error: 'Persona not found' });
      }
  
      return res.json(persona);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

module.exports = router;