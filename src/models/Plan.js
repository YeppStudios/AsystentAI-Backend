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
});

mongoose.model('Plan', PlanSchema);
