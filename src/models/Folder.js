const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
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
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
});

mongoose.model('Folder', FolderSchema);
