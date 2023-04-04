const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: ""
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    savedBy: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
});

mongoose.model('Content', ContentSchema);
