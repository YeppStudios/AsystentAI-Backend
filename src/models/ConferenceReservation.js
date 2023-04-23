const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    spots: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    email: [{type: String}],
    phone: {
        type: String,
        default: ""
    }
});

mongoose.model('Reservation', ReservationSchema);
