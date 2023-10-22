const mongoose = require('mongoose');
  
  const ProfileSchema = new mongoose.Schema({
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Workspace',
    },
    title: {
        type: String,
        required: true,
        default: "Untitled"
    },
    subfolders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
    }],
    totalDocsCount: {
        type: Number,
        default: 0
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
    imageUrl: {
        type: String, 
        default: ""
    }, 
    description: {
        type: String,
        default: ""
    }
  });
  
mongoose.model('Profile', ProfileSchema);
