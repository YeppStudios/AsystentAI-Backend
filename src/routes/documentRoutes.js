const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Document = mongoose.model('Document');
  
// CREATE
router.post('/add-document', (req, res) => {
  const document = new Document(req.body);
  document.save()
    .then(() => {
      res.status(201).json({ document });
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
});

// READ
router.get('/get-documents', (req, res) => {
  Document.find()
    .then(documents => {
      res.json(documents);
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

router.get('/get-document/:id', (req, res) => {
  Document.findById(req.params.id)
    .then(document => {
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json(document);
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// UPDATE
router.put('/update-document/:id', (req, res) => {
  Document.findByIdAndUpdate(req.params.id, req.body)
    .then(document => {
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json({ message: 'Document updated successfully' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// DELETE
router.delete('/delete-document/:id', (req, res) => {
  Document.findByIdAndDelete(req.params.id)
    .then(document => {
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json({ message: 'Document deleted successfully' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

module.exports = router;
