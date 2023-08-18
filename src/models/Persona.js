const mongoose = require('mongoose');

const PersonaSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
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
    }
});

mongoose.model('Persona', PersonaSchema);
