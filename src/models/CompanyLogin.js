const mongoose = require('mongoose');

const CompanyLoginSchema = new mongoose.Schema({
  workspaceId: {
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

mongoose.model('CompanyLogin', CompanyLoginSchema);