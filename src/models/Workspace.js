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
            type: String,
            required: true
        },
        code: {
            type: String,
            required: true,
            unique: true
        },
        role: {
            type: String,
            required: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    apiKey: {
        type: String
    }
});

mongoose.model('Workspace', WorkspaceSchema);
