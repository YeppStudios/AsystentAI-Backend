const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversation: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Conversation' 
    },
    sender: {
        type: String,
        enum: ["user", "assistant"]
    },
    text: String,
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
});

mongoose.model('Message', MessageSchema);
