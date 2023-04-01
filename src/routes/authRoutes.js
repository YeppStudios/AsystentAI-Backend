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
const bcrypt = require('bcrypt');
const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

const whitelistedEmails = ["karolina.wojciechowska@sprawnymarketing.pl", "leszek.lewandowicz@sprawnymarketing.pl", "anna.kolodziej@sprawnymarketing.pl", "jacek.adamczak@sprawnymarketing.pl", "wojciech.markowski@sprawnymarketing.pl", "katarzyna.granops.szkoda@sprawnymarketing.pl", "piotrg2003@gmail.com"];

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, isCompany } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      // User already exists, log them in
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ token, user });
    }

    try {
      await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID, {
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: name,
      },
      });
    } catch (error) {
      console.error('Failed to add user to Mailchimp audience:', error.message);
    }
    
    // User doesn't exist, register them
    let accountType = 'individual';
    if (isCompany) {
      accountType = 'company';
    }

    user = new User({
      email,
      password,
      name,
      accountType,
    });

    let transaction;
    if(whitelistedEmails.includes(user.email)){
      transaction = new Transaction({
        value: 500000,
        title: "+500k na start ;)",
        type: "income",
        timestamp: Date.now()
      });
      user.tokenBalance += 500000;
      user.transactions.push(transaction);
      await transaction.save();
    }

    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});


router.post('/register-free-trial', async (req, res) => {
  try {
      const { email, password, name, isCompany, referrerId } = req.body;
      const user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: 'User already exists' });
      
      let accountType = 'individual';
      if(isCompany){
        accountType = 'company';
      }

      try {
        await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID, {
          email_address: email,
          status: 'subscribed',
          merge_fields: {
            FNAME: name,
        },
        });
      } catch (error) {
        console.error('Failed to add user to Mailchimp audience:', error);
      }
      
      const newUser = new User({
          email,
          password,
          name,
          accountType: accountType,
          referredBy: referrerId
      });
      let transaction;
      if(whitelistedEmails.includes(newUser.email)){
        transaction = new Transaction({
          value: 500000,
          title: "+500k na start ;)",
          type: "income",
          timestamp: Date.now()
        });
        newUser.tokenBalance += 500000;
        newUser.transactions.push(transaction);
        await transaction.save();
      } else {
        transaction = new Transaction({
          value: 10000,
          title: "+10 000 elixiru na start",
          type: "income",
          timestamp: Date.now()
      });
      newUser.tokenBalance += 10000;
      newUser.transactions.push(transaction);
      await transaction.save();
      }

      await newUser.save();
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

  router.post('/password-reset', async (req, res) => {
    const { email } = req.body;
    // Generate a unique token and store it in the database
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // Send an email to the user's email address containing the password reset link
    const resetLink = `https://www.asystent.ai/password-reset-confirm?token=${token}&userId=${user._id}`;
    return res.status(200).json({ link: resetLink });
  });
  
  router.post('/reset-password-confirm', async (req, res) => {
    const { userId, password, token } = req.body;
    const user = await User.findById(userId);
  
    if(!user){
      return res.status(404).send({
        error: 'User not found'
      });
    }
  
    if (!token) {
      return res.status(401).send({
        error: 'No token provided'
      });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).send({
          error: 'Invalid token'
        });
      }
  
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        user.password = hash;
        await user.save();
        return res.status(201).send({
          message: 'Password updated'
        });
      } catch (err) {
        return res.status(500).send({
          error: 'Error encrypting password'
        });
      }
    });
  });
  

module.exports = router;