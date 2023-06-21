const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    monthlyTokens: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    priceId: {
        type: String
    },
    maxFiles: {
        type: Number,
        required: true,
        default: 3
    },
    maxFolders: {
        type: Number,
        default: 1
    },
    maxUploadedBytes: {
        type: Number,
        required: true,
        default: 5242880
    },
    maxAssistants: {
        type: Number,
        required: true,
        default: 1
    }
});

mongoose.model('Plan', PlanSchema);
