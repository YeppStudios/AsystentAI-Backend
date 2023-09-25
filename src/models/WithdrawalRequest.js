const mongoose = require('mongoose');

const WithdrawalRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    ibanNumber: {
        type: String,
        required: true
    },
});
mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);
