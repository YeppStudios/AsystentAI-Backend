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
    },
    title: {
        type: String,
        default: "New Content"
    },
    icon: {
        type: String,
    },
    query: {
        type: String,
        default: "post"
    },
    contentType: {
        type: String,
        enum: [
            "Facebook-post",
            "Instagram-post",
            "text-editor",
            "article-section",
            "email",
            "article-conspect",
            "Twitter-post",
            "Linkedin-post",
            "google-ads",
            "newsletter",
            "newsletter-conspect",
            "amazon",
            "allegro",
            "document"
        ],
        default: "document" // Set a default value if needed
    },
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
    }
});

mongoose.model('Content', ContentSchema);
