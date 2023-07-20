const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String,
    },
    category: {
        type: String,
        required: true
    },
    author: {
        type: String,
        default: ""
    },
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] }
});

mongoose.model('Template', TemplateSchema);
