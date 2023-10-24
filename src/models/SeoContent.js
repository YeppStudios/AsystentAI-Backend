const mongoose = require('mongoose');

const SeoContentSchema = new mongoose.Schema({
  title: String,
  content: [{
    type: Object,
  }],
  embeddedVetorIds: [{
    type: String,
  }],
  owner: String,
  savedBy: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
  }
});

const SeoContent = mongoose.model('SeoContent', SeoContentSchema);
module.exports = SeoContent;
