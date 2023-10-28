const mongoose = require('mongoose');

const CompanyLoginSchema = new mongoose.Schema({
  strengths: {
    type: Array
  },
  weaknesses: {
    type: Array
  },
  opportunities: {
    type: Array,
  },
  threats: {
    type: Array,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

mongoose.model('CompanyLogin', CompanyLoginSchema);