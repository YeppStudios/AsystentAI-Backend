const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    templates: [{
        data: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Template',
            required: true
        },
        text: {
            type: String,
            default: ""
        }
    }],
    type: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true,
    },
    toneOfVoice: {
        type: String,
        required: true,
    },
    about: {
        type: String,
        required: true,
    },
    useEmojis: {
        type: Boolean,
        required: true,
    },
    targetAudience: {
        type: String,
        required: true,
    },
    objective: {
        type: String,
        required: true,
    },
    keywords: {
        type: String,
        required: true,
    },
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
    }],
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Workspace',
    },
});

mongoose.model('Campaign', CampaignSchema);
