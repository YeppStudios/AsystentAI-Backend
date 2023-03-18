const mongoose = require('mongoose');

const PromptSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    hashtags: [{type: String}],
    author: {
        type: String,
        default: ""
    },
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] }
});

mongoose.model('Prompt', PromptSchema);
