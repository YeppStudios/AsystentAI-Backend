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
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        default: ""
    }
});

mongoose.model('ConferenceReservation', ReservationSchema);


const BusinessReservation = new mongoose.Schema({
    company: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    website: {
        type: String,
        required: true
    }
});

mongoose.model('BusinessReservation', BusinessReservation);
