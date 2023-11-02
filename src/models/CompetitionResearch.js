const mongoose = require('mongoose');


const CompetitorSchema = new mongoose.Schema({
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
    required: true,
  },
  pageContent: {
    type: String,
    default: "",
  },
  vectorId: {
    type: String,
    default: "",
  }
});


const CompetitionResearch = new mongoose.Schema({
  companies: [
    {CompetitorSchema}
  ],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
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