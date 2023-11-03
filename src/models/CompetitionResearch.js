const mongoose = require('mongoose');

const CompetitionResearch = new mongoose.Schema({
  companies: [
    {
      name: {
        type: String,
        default: "",
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      imageUrl: {
        type: String,
      },
      vectorId: {
        type: String,
        default: "",
      }
    }
  ],
  title: {
    type: String,
    default: "",
    required: true,
  },
  endGoal: {
    type: String,
    default: "",
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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