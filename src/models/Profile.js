const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    targetAudience: {
        type: String,
        required: true,
        default: ""
    },
    background: {
        type: String,
        required: true,
        default: ""
    },
    goals: {
        type: String,
        required: true,
        default: ""
    },
    values: {
        type: String,
        required: true,
        default: ""
    },
    advantages: {
        type: String,
        required: true,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    name: {
        type: String,
        required: true,
        default: ""
    }
});

mongoose.model('Profile', ProfileSchema);
