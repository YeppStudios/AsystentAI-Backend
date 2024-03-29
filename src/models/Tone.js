const mongoose = require('mongoose');

const ToneSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    base_text: {
        type: String,
        default: ""
    },
    prompt: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
    }
});

mongoose.model('Tone', ToneSchema);
