const mongoose = require('mongoose');

const WhitelistSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    expireAt: {
        type: Date,
        default: Date.now()
    }
});

mongoose.model('Whitelist', WhitelistSchema);
