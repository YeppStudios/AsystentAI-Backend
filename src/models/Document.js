const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    ownerEmail: { 
      type: String, 
    },
    workspace: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Workspace' 
    },
    title: {
        type: String,
        required: true,
        default: "Untitled"
    },
    vectorId: {
        type: String,
        required: true,
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
  