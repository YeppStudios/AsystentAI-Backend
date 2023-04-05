const mongoose = require('mongoose');

const TokenTransactionSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    value: {
        type: Number,
    },
    title: {
        type: String,
        require: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['expense', 'income']
    },
    category: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
})

mongoose.model('Transaction', TokenTransactionSchema);