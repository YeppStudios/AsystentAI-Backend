const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    tokenBalance: {
        type: Number,
        required: true,
        default: 0
    },
    employeeCount: {
        type: Number,
        required: true,
        default: 0
    },
    employees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

mongoose.model('Company', CompanySchema);
