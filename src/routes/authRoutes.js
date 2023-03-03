const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Whitelist = mongoose.model('Whitelist');
const Transaction = mongoose.model('Transaction');
const requireAuth = require('../middlewares/requireAuth');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();


router.post('/register', async (req, res) => {
  try {
      const { email, password, name, isCompany } = req.body;
      const user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: 'User already exists' });

      let accountType = 'individual';
      if(isCompany){
        accountType = 'company';
      }

      const newUser = new User({
          email,
          password,
          name,
          accountType: accountType,
      });

      await newUser.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ token, newUser });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});

router.post('/register-free-trial', async (req, res) => {
  try {
      const { email, password, name, isCompany } = req.body;
      const user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: 'User already exists' });

      let accountType = 'individual';
      if(isCompany){
        accountType = 'company';
      }

      const newUser = new User({
          email,
          password,
          name,
          accountType: accountType,
      });

      const transaction = new Transaction({
        value: 10000,
        title: "+10 000 elixiru na start",
        type: "income",
        timestamp: Date.now()
    });

    newUser.transactions.push(transaction);
    newUser.tokenBalance += 10000;

      await newUser.save();
      await transaction.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ token, newUser });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});


//login only for whitelisted and with stripe plans
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: 'User not found' });

//     // Check if user's email is on the whitelist
//     const isWhitelisted = await Whitelist.exists({ email: email });
    
//     if (!isWhitelisted) {
//       // Check if user's email is associated with a customer in Stripe
//       const customers = await stripe.customers.list({ email: email });
//       const isSubscribed = customers.data.length > 0;
//       if (!isSubscribed) return res.status(400).json({ message: 'User is not a subscriber' });
      
//     } else {
//       //if user is a subscriber but did not finish registration
//       if(!(user.street)){
//         return res.status(400).json({ message: 'User did not complete registration' });
//       }
//     }

//     await user.comparePassword(password);

//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
//     return res.json({ token, user });
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// });

//open login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    await user.comparePassword(password);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});



router.post('/logout', async (req, res) => {
  try {
      // Invalidate the token here. 
      // One way to do this is to store a list of valid tokens in the database 
      // and remove the token from the list when a user logs out
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});

router.post('/refresh', requireAuth, async (req, res) => { //refresh token
  try {
      const user = req.user;
      const accessToken = generateAccessToken(user);
      const refreshToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
      user.refreshToken = refreshToken;
      await user.save();
      res.json({ accessToken, refreshToken });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

// This endpoint will handle resetting a user's password. The first endpoint takes the user's email address as a parameter, 
//it checks if the user exists, generates a token and sends an email to the user with a link to reset their password. 
//The second endpoint takes the token and the new password as parameters, verifies that the token is valid, 
//updates the user's password, and returns a success message.

// You will need to include the necessary modules such as crypto, bcrypt and any other libraries you may use to send email.

// You will also need to include a function that generates access token using the user's information.

router.post('/password/forgot', async (req, res) => {
  try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // expires in an hour
      await user.save();
      const resetUrl = `${req.headers.origin}/password/reset/${token}`;
      const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
      await sendMail({
          email: user.email,
          subject: 'Password reset token',
          message
      });
      return res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});

router.put('/password/reset/:token', async (req, res) => {
  try {
      const { password } = req.body;
      const user = await User.findOne({
          resetPasswordToken: req.params.token,
          resetPasswordExpires: { $gt: Date.now() }
      });
      if (!user) {
          return res.status(404).json({ message: 'Token expired or invalid' });
      }
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      const accessToken = generateAccessToken(user);
      return res.status(200).json({ message: 'Password reset successful', accessToken });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});


router.get('/checkJWT', (req, res) => {
    const { authorization } = req.headers;
  
    if (!authorization) {
      return res.status(401).send({
        error: 'No token provided'
      });
    }
    const token = authorization.replace('Bearer ', '');
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({
          error: 'Invalid token'
        });
      }
  
      return res.send({
        valid: true
      });
    });
  });

module.exports = router;