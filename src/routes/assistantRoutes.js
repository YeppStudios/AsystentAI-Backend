const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');

const Assistant = mongoose.model('Assistant');

// CREATE
router.post('/create-assistant', requireAuth, (req, res) => {
  const assistant = new Assistant(req.body);
  assistant.save()
    .then(() => {
      res.status(201).json({ assistant });
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
});

// READ
router.get('/get-assistants', (req, res) => {
  Assistant.find()
    .populate('documents') // populate documents field with actual documents
    .then(assistants => {
      return res.json(assistants);
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// READ all assistants for owner by owner id
router.get('/getUserAssistants/:userId', requireAuth, (req, res) => {
    Assistant.find({ owner: req.params.userId })
      .populate('documents') // populate documents field with actual documents
      .then(assistants => {
        return res.json({assistants: assistants});
      })
      .catch(err => {
        return res.status(500).json({ error: err.message });
      });
});


router.get('/get-assistant/:id', (req, res) => {
  Assistant.findById(req.params.id)
    .populate('documents') // populate documents field with actual documents
    .then(assistant => {
      if (!assistant) {
        return res.status(404).json({ message: 'Assistant not found' });
      }
      res.json(assistant);
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// UPDATE
router.put('/update-assistant/:id', requireAuth, (req, res) => {
  Assistant.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, req.body)
    .then(assistant => {
      if (!assistant) {
        return res.status(404).json({ message: 'Assistant not found or not authorized to modify' });
      }
      return res.json({ message: 'Assistant updated successfully' });
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});


// DELETE
router.delete('/delete-assistant/:id', (req, res) => {
  Assistant.findByIdAndDelete(req.params.id)
    .then(assistant => {
      if (!assistant) {
        return res.status(404).json({ message: 'Assistant not found' });
      }
      res.json({ message: 'Assistant deleted successfully' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

module.exports = router;
