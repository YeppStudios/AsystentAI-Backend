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
    maxProfiles: {
        type: Number,
        required: true,
        default: 1
    }
});

mongoose.model('Plan', PlanSchema);
