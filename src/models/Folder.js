const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    ownerEmail: {
        type: String,
        default: ""
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Workspace',
    },
    title: {
        type: String,
        required: true,
        default: "Untitled"
    },
    category: {
        type: String,
        required: true,
        default: "other"
    },
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
    }],
    parentFolder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
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

FolderSchema.virtual('docsCount').get(function() {
    return this.documents.length;
});

FolderSchema.pre('save', function(next) {
    this.totalDocsCount = this.documents.length;
    next();
});

mongoose.model('Folder', FolderSchema);
