const mongoose = require('mongoose');

const AssistantSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    name: {
        type: String,
        required: true,
        default: "Assistant"
    },
    description: {
        type: String,
    },
    image: {
        type: String,
        default: ""
    },
    category: {
        type: String,
    },
    prompt: {
        type: String,
        required: true
    },
    noEmbedPrompt: {
        type: String,
    },
    folders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
    }],
    documents: [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Document' 
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

mongoose.model('Assistant', AssistantSchema);
