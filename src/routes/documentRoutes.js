const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const Document = mongoose.model('Document');
const Folder = mongoose.model('Folder');
const Workspace = mongoose.model('Workspace');
const Assistant = mongoose.model('Assistant');
const User = mongoose.model('User');
const Profile = mongoose.model('Profile');
const axios = require('axios');

router.post('/add-document', requireAuth, async (req, res) => {
  let document;
  try {
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
        websiteUrl: req.body.websiteUrl,
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
        websiteUrl: req.body.websiteUrl,
      });
      await user.save();
    }

    await document.save();
    document = await Document.findById(document._id).populate('owner');

    return res.status(201).json({ document });

  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
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
      const folderCount = await Folder.countDocuments({ owner: mongoose.Types.ObjectId(userId) });
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
    const folder = await Folder.findOne({ _id: req.params.id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const documentId = req.body.documentId;

    if (!documentId) {
      return res.status(400).json({ message: 'documentId is required' });
    }

    folder.documents.push(documentId);
    await folder.save();
    await Assistant.updateMany({ folders: req.params.id }, { $push: { documents: documentId } });
    return res.status(200).json({ message: 'Document added to folder and assistants successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


router.get('/folders/:folderId/subfolders', async (req, res) => {
  try {
      const folderId = req.params.folderId;

      const folder = await Folder.findById(folderId).populate('subfolders');
      if (!folder) {
          return res.status(404).send({ message: 'Folder not found' });
      }

      // Return the populated subfolders
      res.status(200).send(folder.subfolders);
  } catch (error) {
      res.status(500).send({ message: 'Server error', error: error.message });
  }
});

// ADD DOCUMENTS TO FOLDER
router.post('/folders/:id/add-documents', requireAuth, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    folder.documents.push(req.body.documents);
    await folder.save();
    await Assistant.updateMany({ folders: req.params.id }, { $push: { documents: req.body.documents } });
    return res.status(200).json({ message: 'Document added to folder and assistants successfully' });
  } catch (err) {
    console.log(err)
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


router.post('/add-folder', requireAuth, async (req, res) => {
  const { title, category, workspace, documents, owner, parentFolder, ownerEmail, imageUrl, description, profileId } = req.body;
  try {

      let folderData = {
          owner,
          title: title || "Untitled",
          category: category || "other",
          documents: documents || [],
          workspace: workspace,
          parentFolder: parentFolder || null,
          ownerEmail: ownerEmail,
          imageUrl: imageUrl,
          description: description,
          profile: profileId || null
      };

      if (parentFolder) {
          folderData.parentFolder = parentFolder;
      } else {
          folderData.parentFolder = null;
      }

      let folder = new Folder(folderData);
      await folder.save();

      // Populate owner after saving the folder
      folder = await Folder.findById(folder._id).populate('owner');

      if (parentFolder) {
          const parent = await Folder.findById(parentFolder);
          if (parent) {
              parent.subfolders.push(folder._id);
              await parent.save();
          }
      }

      if (profileId) {
        const profile = await Profile.findById(profileId);
        if (profile) {
            profile.subfolders.push(folder._id);
            await profile.save();
        }
      }

      return res.status(201).json({ folder });

  } catch (e) {
      console.log(e);
      return res.status(500).json({ error: e.message });
  }
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


  const deepPopulateSubfolders = async (folder) => {
    if (folder && folder.subfolders && folder.subfolders.length > 0) {
      for (let i = 0; i < folder.subfolders.length; i++) {
        let subfolder = await Folder.findById(folder.subfolders[i])
                                     .populate()
                                     .lean();
        if (subfolder) {
          folder.subfolders[i] = await deepPopulateSubfolders(subfolder);
        } else {
          throw new Error(`Subfolder with id ${folder.subfolders[i]} not found.`);
        }
      }
    }
    return folder;
  }
  
  router.get('/folders/:workspaceId', async (req, res) => {
    let { page = 0, limit = 100 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
  
    try {
      let mainFolders = await Folder.find({ 
          workspace: req.params.workspaceId,
          parentFolder: null
        })
        .sort({ updatedAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .populate({
          path: 'owner',
          model: 'User',
          select: 'email name'
      })
        .lean();
  
      mainFolders = mainFolders.map(folder => {
        folder.directDocumentCount = folder.documents.length;
        return folder;
      });
  
      mainFolders = await Promise.all(mainFolders.map(async folder => {
        return await deepPopulateSubfolders(folder);
      }));
  
      return res.json(mainFolders);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  
  router.get('/folders_by_profile/:profileId', async (req, res) => {
    let { page = 0, limit = 100 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
  
    try {
      let mainFolders = await Folder.find({ 
          profile: req.params.profileId,
          parentFolder: null
        })
        .sort({ updatedAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .populate({
          path: 'owner',
          model: 'User',
          select: 'email name'
      })
        .lean();
  
      mainFolders = mainFolders.map(folder => {
        folder.directDocumentCount = folder.documents.length;
        return folder;
      });
  
      mainFolders = await Promise.all(mainFolders.map(async folder => {
        return await deepPopulateSubfolders(folder);
      }));
  
      return res.json(mainFolders);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  

  router.get('/folders/owner/:userId', async (req, res) => {
    let { page = 0, limit = 100 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
  
    try {
      let mainFolders = await Folder.find({ 
          owner: req.params.userId,
          parentFolder: null 
        })
        .sort({ updatedAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .populate({
          path: 'owner',
          model: 'User',
          select: 'email name' 
        })
        .lean();
  
      mainFolders = mainFolders.map(folder => {
        folder.directDocumentCount = folder.documents.length;
        return folder;
      });
  
      mainFolders = await Promise.all(mainFolders.map(async folder => {
        return await deepPopulateSubfolders(folder);
      }));
  
      return res.json(mainFolders);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  
  router.get('/getFolder/:id', requireAuth, async (req, res) => {
    try {
      let folder = await Folder.findById(req.params.id)
        .populate({
          path: 'documents',
          populate: {
            path: 'owner',
            model: 'User',
            select: 'email name'
          }
        })
        .populate({
          path: 'subfolders',
          model: 'Folder',
          populate: {
            path: 'owner',
            model: 'User',
            select: 'email name'
          }
        })
        .populate('parentFolder');
        
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      
      let lineage = [];
      let currentFolder = folder;
      while (currentFolder.parentFolder) {
        currentFolder = await Folder.findById(currentFolder.parentFolder);
        lineage.push(currentFolder);
      }
  
      return res.json({
        folder: folder,
        lineage: lineage
      });
  
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  });
  


  // UPDATE
  router.patch('/folders/:id', requireAuth, (req, res) => {
    Folder.findById(req.params.id)
      .then(folder => {
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }

        if ( req.body.title ) {
          folder.title = req.body.title;
        }

        if ( req.body.workspace ) {
          folder.workspace = req.body.workspace;
        }

        if (req.body.imageUrl) {
          folder.imageUrl = req.body.imageUrl;
        }

        if (req.body.description) {
          folder.description = req.body.description;
        }

        return folder.save();
      })
      .then(() => {
        return res.json({ message: 'Folder updated successfully' });
      })
      .catch(err => {
        return res.status(500).json({ error: err.message });
      });
});

router.patch('/assign_profile_to_folders', async (req, res) => {
  const folderArray = req.body.folders;
  const { profileId } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'Profile ID is required' });
  }

  if (!Array.isArray(folderArray) || folderArray.length === 0) {
    return res.status(400).json({ error: 'An array of folder objects is required' });
  }

  const updatePromises = folderArray.map(async (folder) => {
    if (!folder._id) {
      return { _id: folder._id, status: 'skipped', reason: 'Missing _id' };
    }

    try {
      const updatedFolder = await Folder.findByIdAndUpdate(
        folder._id,
        { $set: { profile: profileId } },
        { new: true }
      );

      if (!updatedFolder) {
        return { _id: folder._id, status: 'failed', reason: 'Not found' };
      }

      return { _id: folder._id, status: 'updated' };
    } catch (error) {
      console.error(error);
      return { _id: folder._id, status: 'failed', reason: 'Internal Error' };
    }
  });

  try {
    const updateResults = await Promise.all(updatePromises);
    return res.json(updateResults);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.delete('/user/:userId/folders/:id', requireAuth, async (req, res) => {
  try {
      const user = await User.findById(req.params.userId);
      const vectorIds = [];

      const deleteFolderRecursively = async (folderId) => {
          const folder = await Folder.findById(folderId);
          if (!folder) return;

          for (let documentId of folder.documents) {
            if (documentId) {
              const document = await Document.findById(documentId.toString());
              if (document) {
                  vectorIds.push(document.vectorId);
                  user.uploadedBytes -= document.documentSize;
                  await document.remove();
              }
            }
          }

          for (let subfolderId of folder.subfolders) {
              await deleteFolderRecursively(subfolderId.toString());
          }

          if (folder.parentFolder) {
              await Folder.findByIdAndUpdate(folder.parentFolder, {
                  $pull: { subfolders: folder._id }
              });
          }

          if (folder.profile) {
            await Profile.findByIdAndUpdate(folder.profile, {
                $pull: { subfolders: folder._id }
            });
        }

          await folder.remove();
      };

      await deleteFolderRecursively(req.params.id);

      if (vectorIds.length > 0) {
          await axios.delete(
              "https://www.asistant.ai/delete",
              {
                  data: { ids: vectorIds },
                  headers: {
                      Authorization: `Bearer ${process.env.PYTHON_API_KEY}`,
                  },
              }
          );
      }

      await user.save();

      return res.json({ message: 'Folder, its subfolders, and their documents deleted successfully' });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
});

router.patch('/transferOwnership', requireAdmin, async (req, res) => {
  const { current_owner_id, new_owner_id, new_owner_email, new_workspace_id } = req.body;

  if (!current_owner_id || !new_owner_id || !new_owner_email || !new_workspace_id) {
      return res.status(400).json({ error: 'Owner information is incomplete' });
  }

  try {
      await Document.updateMany(
          { owner: current_owner_id },
          {
              owner: new_owner_id,
              ownerEmail: new_owner_email,
              workspace: new_workspace_id
          }
      );

      await Folder.updateMany(
          { owner: current_owner_id },
          {
              owner: new_owner_id,
              workspace: new_workspace_id,
              ownerEmail: new_owner_email
          }
      );

      return res.json({ success: true, message: 'Ownership transferred successfully.' });
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
