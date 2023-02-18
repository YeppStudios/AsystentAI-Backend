const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
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
        default: 'Nowa Konwersacja'
    }
});

mongoose.model('Conversation', ConversationSchema);