const mongoose = require('mongoose');


const WorkspaceSchema = new mongoose.Schema({
    admins: [{
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        required: true
    }],
    company: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        required: true
    },
    employees: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        role: {
          type: String,
          enum: ['employee', 'manager', 'admin'],
          default: 'employee'
        }
      }],
      invitations: [{
        email: {
            type: String
        },
        code: {
            type: String,
        },
        role: {
            type: String,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    apiKey: {
        type: String
    }
});

mongoose.model('Workspace', WorkspaceSchema);
