const mongoose = require('mongoose');

const OnboardingSruveyDataSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    industry: { 
        type: String,
    },
    role: {
        type: String,
    },
    companySize: {
        type: String,
    },
    hasUsedAI: {
        type: Boolean
    },
    firstChosenCategory: {
        type: String
    }
});

mongoose.model('OnboardingSruveyData', OnboardingSruveyDataSchema);
