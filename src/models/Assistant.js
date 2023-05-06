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
        required: true,
    },
    prompt: {
        type: String,
        required: true
    },
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
