const express = require('express');
const mongoose = require('mongoose');
const Campaign = mongoose.model('Campaign');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();

router.post('/addCampaign', requireAuth, async (req, res) => {
    try {
        const campaign = new Campaign(req.body);
        await campaign.save();
        return res.status(201).send(campaign);
    } catch (err) {
        return res.status(400).send(err);
    }
});

// Read (GET) by ID
router.get('/campaign/:id', requireAuth, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id).populate('templates.data');;
        if (!campaign) {
            return res.status(404).send({ message: 'campaign not found' });
        }
        return res.send(campaign);
    } catch (err) {
        return res.status(500).send(err);
    }
});

router.get('/campaignsByOwner', requireAuth, async (req, res) => {
    try {
        const campaigns = await Campaign.find({ owner: req.user._id });
        return res.send(campaigns);
    } catch (err) {
        return res.status(500).send(err);
    }
});

router.patch('/campaign/:campaignId/template/:templateId', async (req, res) => {
    const { campaignId, templateId } = req.params;
    const { text } = req.body; // Assuming the updated text is sent in the request body

    try {
        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const template = campaign.templates.find(t => t.data.toString() === templateId);

        if (!template) {
            return res.status(404).json({ error: 'Template not found in the campaig' });
        }

        template.text = text;

        await campaign.save();

        res.status(200).json({ message: 'Template text updated successfully', campaign });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


router.patch('/updateCampaign/:id', requireAuth, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) {
            return res.status(404).send({ message: 'campaign not found' });
        }

        // Check if the owner matches the logged in user
        if (campaign.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'You do not have permission to update this campaign' });
        }

        // If the check passes, update the campaign
        const updatedCampaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
        return res.send(updatedCampaign);
    } catch (err) {
        return res.status(400).send(err);
    }
});

// Delete by ID
router.delete('/deleteCampaign/:id', requireAuth, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) {
            return res.status(404).send({ message: 'campaign not found' });
        }

        // Check if the owner matches the logged in user
        if (campaign.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'You do not have permission to delete this campaign' });
        }

        // If the check passes, delete the campaign
        await campaign.remove();
        return res.send(campaign);
    } catch (err) {
        return res.status(500).send(err);
    }
});

  
module.exports = router;