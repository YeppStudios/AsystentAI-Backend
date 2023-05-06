const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const Document = mongoose.model('Document');
const Folder = mongoose.model('Folder');

// CREATE
router.post('/add-document', (req, res) => {
  const document = new Document(req.body);
  document.save()
    .then(() => {
      return res.status(201).json({ document });
    })
    .catch(err => {
      return res.status(400).json({ error: err.message });
    });
});

// READ
router.get('/get-documents', (req, res) => {
  Document.find()
    .then(documents => {
      return res.json(documents);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

router.get('/get-document/:id', (req, res) => {
  Document.findById(req.params.id)
    .then(document => {
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      return res.json(document);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

router.put('/update-document/:id', requireAuth, async (req, res) => {
  const documentId = req.params.id;
  
  try {
    // Find the document and check if it belongs to the authenticated user
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (document.owner.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Update the document
    const updatedDocument = await Document.findByIdAndUpdate(documentId, req.body, { new: true });
    
    return res.json({ message: 'Document updated successfully', document: updatedDocument });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

//DELETE DOCUMENT
router.delete('/delete-document/:id', requireAuth, async (req, res) => {
  const documentId = req.params.id;
  
  try {
    // Find the document and check if it belongs to the authenticated user
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (document.owner.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find all folders that contain the document
    const folders = await Folder.find({ documents: documentId });
    
    // Remove the document ID from the documents array of each folder
    const updateOps = folders.map(folder => {
      return Folder.updateOne({ _id: folder._id }, { $pull: { documents: documentId } });
    });
    await Promise.all(updateOps);
    
    // Delete the document itself
    const result = await Document.findByIdAndDelete(documentId);
    
    if (!result) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    return res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ADD DOCUMENT TO FOLDER
router.post('/folders/:id/add-document', requireAuth, (req, res) => {
  Folder.findOne({ _id: req.params.id, owner: req.user._id })
    .then(folder => {
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      const documentId = req.body.documentId;
      if (!documentId) {
        return res.status(400).json({ message: 'documentId is required' });
      }
      if (folder.documents.includes(documentId)) {
        return res.status(400).json({ message: 'Document already exists in the folder' });
      }
      folder.documents.push(documentId);
      folder.save()
        .then(() => {
          return res.status(200).json({ message: 'Document added to folder successfully' });
        })
        .catch(err => {
          return res.status(500).json({ error: err.message });
        });
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

// DELETE DOCUMENT FROM FOLDER
router.delete('/folders/:id/delete-document', requireAuth, (req, res) => {
  Folder.findOne({ _id: req.params.id, owner: req.user._id })
    .then(folder => {
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      const documentId = req.body.documentId;
      if (!documentId) {
        return res.status(400).json({ message: 'documentId is required' });
      }
      const index = folder.documents.indexOf(documentId);
      if (index === -1) {
        return res.status(404).json({ message: 'Document not found in the folder' });
      }
      folder.documents.splice(index, 1);
      folder.save()
        .then(() => {
          return res.status(200).json({ message: 'Document deleted from folder successfully' });
        })
        .catch(err => {
          return res.status(500).json({ error: err.message });
        });
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});


// CREATE FOLDER
router.post('/add-folder', (req, res) => {
  const { owner, title, category, documents } = req.body;

  Folder.findOne({ owner: owner, title: title })
    .populate('documents')
    .then(existingFolder => {
      if (existingFolder) {
        return res.json({ folder: existingFolder });
      }

      const folder = new Folder({
        owner: owner,
        title: title || "Untitled",
        category: category || "other",
        documents: documents || []
      });

      folder.save()
        .then(() => {
          return res.status(201).json({ folder });
        })
        .catch(err => {
          return res.status(400).json({ error: err.message });
        });
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

  // READ
  router.get('/folders', requireAuth, (req, res) => {
    Folder.find({ owner: req.user._id })
      .then(folders => {
        return res.json(folders);
      })
      .catch(err => {
        return res.status(500).json({ error: err.message });
      });
  });
  
  
  router.get('/folders/:id', (req, res) => {
    Folder.findById(req.params.id)
    .populate('documents')
    .then(folder => {
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      return res.json(folder);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
  });
  
  // UPDATE
  router.put('/folders/:id', requireAuth, (req, res) => {
    Folder.findById(req.params.id)
      .then(folder => {
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }
        if (folder.owner.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'You are not authorized to update this folder' });
        }
        return Folder.findByIdAndUpdate(req.params.id, req.body);
      })
      .then(() => {
        return res.json({ message: 'Folder updated successfully' });
      })
      .catch(err => {
        return res.status(500).json({ error: err.message });
      });
  });


// DELETE FOLDER
router.delete('/folders/:id', requireAuth, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    if (folder.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await folder.remove();
    return res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;
