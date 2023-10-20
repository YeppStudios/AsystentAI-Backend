const mongoose = require('mongoose');

const RegistrationsSchema = new mongoose.Schema({
  email: {
    type: String,
  },
  ip: {
    type: String,
  },
});

mongoose.model('Registrations', RegistrationsSchema);