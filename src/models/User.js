const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const StatsSchema = new mongoose.Schema({
    totalPosts: {
      type: Number,
      default: 0,
    },
    totalEmails: {
      type: Number,
      default: 0,
    },
    totalIdeas: {
      type: Number,
      default: 0,
    },
  });

const BalanceSnapshotSchema = new mongoose.Schema({
    timestamp: {
        type: String,
        required: true,
        default: Date.now
    },
    balance: {
        type: Number,
        required: true,
        default: 1400
    }
});

const UserSchema = new mongoose.Schema({
    name: String,
    email: { 
        type: String, 
        unique: true,
        require:true
    },
    password: {
        type: String,
    },
    tokenBalance: {
        type: Number,
        required: true,
        default: 0
    },
    testTokenBalance: {
        type: Number,
        required: true,
        default: 1500
    },
    profilePicture: {
        type: String,
        default: ''
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    accountType: {
        type: String,
        required: true,
        enum: ['employee', 'individual']
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    purchases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment'}],
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction'}],
    tokenHistory: [{BalanceSnapshotSchema}],
    stats: StatsSchema,
    isBlocked: {
        type: Boolean,
        default: false
    },
    appAdmin: {
        type: Boolean,
        default: false
    },
});

UserSchema.pre('save', function(next){
    const user = this;

    if(!user.isModified('password')){
        return next();
    }

    bcrypt.genSalt(10, (err, salt) => {

        if (err){
            return next(err);
        }

        bcrypt.hash(user.password, salt, (err, hash) => {

            if (err){
                return next(err);
            }

            user.password = hash;

            this.stats = {
                totalPosts: 0,
                totalEmails: 0,
                totalIdeas: 0,
            };
            next();
        })
    })
})

UserSchema.methods.comparePassword = function(userPassword) {
    const user = this;
    return new Promise((resolve, reject) => {
        bcrypt.compare(userPassword, user.password, (err, isMatch) => {

            if (err){
                return reject(err);
            }
            if (!isMatch){
                return reject(false);
            }

            resolve(true);
        });
    })
}

mongoose.model('User', UserSchema);
