const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const e = require('express');
const Document = mongoose.model('Document');
const Folder = mongoose.model('Folder');
const Workspace = mongoose.model('Workspace');
const Assistant = mongoose.model('Assistant');
const User = mongoose.model('User');
const axios = require('axios');

// CREATE
router.post('/add-document', requireAuth, async (req, res) => {
  let document;
  if (req.body.workspace && req.body.workspace !== 'undefined') {
    const workspace = await Workspace.findById(req.body.workspace);
    const company = await User.findById(workspace.company[0].toString());
    company.uploadedBytes += Math.round(req.body.size * 100) / 100;
    document = new Document({
      owner: req.body.owner,
      ownerEmail: req.body.ownerEmail,
      title: req.body.title,
      category: req.body.category,
      timestamp: req.body.timestamp,
      workspace: req.body.workspace,
      vectorId: req.body.vectorId,
      documentSize: req.body.size,
    });
    await company.save();
  } else {
    const user = await User.findById(req.user._id);
    user.uploadedBytes += Math.round(req.body.size * 100) / 100;
    document = new Document({
      owner: req.body.owner,
      ownerEmail: req.body.ownerEmail,
      title: req.body.title,
      category: req.body.category,
      timestamp: req.body.timestamp,
      vectorId: req.body.vectorId,
      documentSize: req.body.size,
    });
    user.save();
  }

  document.save()
    .then(() => {
      return res.status(201).json({ document });
    })
    .catch(err => {
      return res.status(400).json({ error: err.message });
    });
});

// READ
router.get('/get-documents', requireAdmin, (req, res) => {
  Document.find()
    .then(documents => {
      return res.json(documents);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

router.get('/user/:userId/uploadStats', requireAuth, async (req, res) => {
  try {
      const { userId } = req.params;
      const documentCount = await Document.countDocuments({ owner: mongoose.Types.ObjectId(userId) });
      const folderCount = await Document.countDocuments({ owner: mongoose.Types.ObjectId(userId) });
      const user = await User.findById(userId);

      return res.status(200).json({ documentCount, uploadedBytes: user.uploadedBytes, folderCount });
  } catch(err) {
      return res.status(500).json({ error: err.message });
  }
});

router.post('/documents-by-vector-ids', requireAuth, async (req, res, next) => {
  try {
    const { vectorIds } = req.body;
    const documents = await Document.find({ vectorId: { $in: vectorIds } });
    if (!documents.length) {
      return res.json({documents: []});
    }
    return res.json({documents});
  } catch (err) {
    next(err);
  }
});


router.get('/get-document/:id', requireAuth, (req, res) => {
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

//get ids of documents from pinecone
router.post('/getPineconeIds', requireAuth, async (req, res, next) => {
  try {
    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    const vectorIds = await Document.find({ _id: { $in: documents } }).distinct('vectorId');
    return res.json(vectorIds);
  } catch (err) {
    next(err);
  }
});


// DELETE DOCUMENT
router.delete('/user/:userId/delete-document/:vectorId', requireAuth, async (req, res) => {
  const vectorId = req.params.vectorId;
  
  try {
    // Find the document and check if it belongs to the authenticated user
    const document = await Document.findOne({ vectorId: vectorId });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find all folders that contain the document
    const folders = await Folder.find({ documents: document._id });
    
    // Remove the document ID from the documents array of each folder
    const folderUpdateOps = folders.map(folder => {
      return Folder.updateOne({ _id: folder._id }, { $pull: { documents: document._id } });
    });
    await Promise.all(folderUpdateOps);

    // Find all assistants that contain the document
    const assistants = await Assistant.find({ documents: document._id });

    // Remove the document ID from the documents array of each assistant
    const assistantUpdateOps = assistants.map(assistant => {
      return Assistant.updateOne({ _id: assistant._id }, { $pull: { documents: document._id } });
    });
    await Promise.all(assistantUpdateOps);

    const user = await User.findById(req.params.userId);

    if (!user) { 
      return res.status(404).json({ message: 'User not found' });
    } else {
      user.uploadedBytes -= document.documentSize;
      await user.save();
    }

    // Delete the document itself
    const result = await Document.findByIdAndDelete(document._id);

    if (!result) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    return res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ADD DOCUMENT TO FOLDER
router.post('/folders/:id/add-document', requireAuth, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });

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
    await folder.save();
    await Assistant.updateMany({ folders: req.params.id }, { $push: { documents: documentId } });
    return res.status(200).json({ message: 'Document added to folder and assistants successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
router.post('/add-folder', requireAuth, (req, res) => {
  const { title, category, workspace, documents } = req.body;
  Folder.findOne({ owner: req.user._id, title: title })
    .populate('documents')
    .then(existingFolder => {
      if (existingFolder) {
        existingFolder.documents.push(...documents);
        existingFolder.save();
        return res.json({ folder: existingFolder });
      }
      try {
        let folder;
        if (workspace && workspace !== 'undefined' && workspace !== 'null') {
          folder = new Folder({
            owner: req.user._id,
            title: title || "Untitled",
            category: category || "other",
            documents: documents || [],
            workspace: workspace
          });
        } else {
          folder = new Folder({
            owner: req.user._id,
            title: title || "Untitled",
            category: category || "other",
            documents: documents || [],
          });
        }
        folder.save()
        return res.status(201).json({ folder });
      } catch (e) {
        console.log(e)
        return res.status(500).json({ error: err.message });
      }
      
    });
  });

  router.post('/folders/documents', requireAuth, async (req, res) => {
    const folderIds = req.body.folderIds;
    const vectorIds = [];

    try {
      // Find all folders matching the provided ids
      const folders = await Folder.find({ _id: { $in: folderIds } }).populate('documents');

      // Extract all vectorIds from the documents in the folders
      folders.forEach(folder => {
        folder.documents.forEach(document => {
          vectorIds.push(document._id);
        });
      });

      // Return the list of vectorIds
      return res.status(200).json(vectorIds);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // READ
router.get('/folders/:workspaceId', requireAuth, (req, res) => {
  let { page = 0, limit = 10 } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  Folder.find({ workspace: req.params.workspaceId })
    .sort({ updatedAt: -1 }) // Sort folders by updatedAt in descending order
    .skip(page * limit)
    .limit(limit)
    .then(folders => {
      return res.json(folders);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});

router.get('/folders/owner/:userId', requireAuth, (req, res) => {
  let { page = 0, limit = 10 } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  Folder.find({ owner: req.params.userId })
    .sort({ updatedAt: -1 }) // Sort folders by updatedAt in descending order
    .skip(page * limit)
    .limit(limit)
    .then(folders => {
      return res.json(folders);
    })
    .catch(err => {
      return res.status(500).json({ error: err.message });
    });
});


  
  router.get('/getFolder/:id', requireAuth, (req, res) => {
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
router.delete('/user/:userId/folders/:id', requireAuth, async (req, res) => {
  try {
      const folder = await Folder.findById(req.params.id);
      if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
      }
      if (folder.owner.toString() !== req.user._id.toString()) {
          return res.status(401).json({ message: 'Unauthorized' });
      }

      const user = await User.findById(req.params.userId);

      // Create an array to hold vectorIds of all documents
      let vectorIds = [];

      // Delete all documents in the folder
      for (let documentId of folder.documents) {
          const document = await Document.findById(documentId.toString());
          if (document) {
              // Add vectorId of the document to the array
              vectorIds.push(document.vectorId);

              user.uploadedBytes -= document.documentSize;
              await document.remove();
          }
      }

      // After all documents are deleted from MongoDB, delete them from Whale App
      if (folder.documents.length > 0) {
        await axios.delete(
            "https://whale-app-p64f5.ondigitalocean.app/delete",
            {
                data: {
                    ids: vectorIds, // send all vectorIds at once
                },
                headers: {
                    Authorization: `Bearer ${process.env.PYTHON_API_KEY}`,
                },
            }
        );
      }
      // After all documents deleted, remove the folder itself
      await folder.remove();
      await user.save();

      return res.json({ message: 'Folder and its documents deleted successfully' });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
});
module.exports = router;
