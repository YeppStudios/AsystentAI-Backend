const mongoose = require('mongoose');

const AssistantSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    name: {
        type: String,
        required: true,
        default: "Assistant AI"
    },
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    companyName: {
        type: String,
        default: ""
    },
    aboutCompany: {
        type: String,
        default: ""
    },
    exampleContent: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        default: "caht"
    },
    prompt: {
        type: String,
        required: true
    },
    noEmbedPrompt: {
        type: String,
        default: ""
    },
    folders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
    }],
    documents: [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Document',
        default: []
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
    }
});

mongoose.model('Assistant', AssistantSchema);
