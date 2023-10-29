const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CompetitionResearch = mongoose.model('CompetitionResearch');

router.post('/create-competition-research', async (req, res) => {
  try {
    const newRecord = new CompetitionResearch(req.body);
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.get('/competition-list/:profileId', async (req, res) => {
    try {
      const records = await CompetitionResearch.find({ profile: req.params.profileId });
      res.status(200).json(records);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

router.get('/competition-list', async (req, res) => {
  try {
    const records = await CompetitionResearch.find();
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get('/competition-research/:id', async (req, res) => {
  try {
    const record = await CompetitionResearch.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Not Found' });
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/competition-research/:id', async (req, res) => {
  try {
    const updatedRecord = await CompetitionResearch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRecord) return res.status(404).json({ message: 'Not Found' });
    res.status(200).json(updatedRecord);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.delete('/competition-research/:id', async (req, res) => {
  try {
    const deletedRecord = await CompetitionResearch.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Not Found' });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;