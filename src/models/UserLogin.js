const mongoose = require('mongoose');

const UserLoginSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // This should match the model name of your User model
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

mongoose.model('UserLogin', UserLoginSchema);