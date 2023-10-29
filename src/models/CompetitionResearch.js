const mongoose = require('mongoose');

const CompetitionResearch = new mongoose.Schema({
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
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
  }
});

mongoose.model('CompetitionResearch', CompetitionResearch);