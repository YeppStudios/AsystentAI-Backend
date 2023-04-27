const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    title: {
        type: String,
        required: true,
        default: "Untitled"
    },
    category: {
        type: String,
        required: true,
        default: "other"
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
});

mongoose.model('Document', DocumentSchema);

DocumentSchema.pre('validate', function(next) {
    const doc = this;
    if (!doc.id) {
      Document.countDocuments().then(function(count) {
        doc.id = (count + 1).toString();
        next();
      }).catch(function(err) {
        next(err);
      });
    } else {
      next();
    }
  });
  