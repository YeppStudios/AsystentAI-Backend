const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    price: {
        type:Number,
        require: true,
    },
    tokens: {
        type:Number,
        require: true,
    },
    title: {
        type: String,
        require: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['recurring', 'one-time']
    }
})

mongoose.model('Payment', PaymentSchema);