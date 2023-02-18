const mongoose = require('mongoose');

const TokenTransactionSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    value: {
        type: Number,
        require: true,
    },
    title: {
        type: String,
        require: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['expense', 'income']
    }
})

mongoose.model('Transaction', TokenTransactionSchema);