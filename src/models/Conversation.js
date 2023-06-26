const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    assistant: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Assistant' 
    },
    startTime: { 
        type: Date, 
        default: Date.now 
    },
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }],
    lastUpdated: {
        type: Date, 
        default: Date.now 
    },
    title: {
        type: String,
        default: 'New Conversation'
    }
});

mongoose.model('Conversation', ConversationSchema);
