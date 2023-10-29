const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Workspace = mongoose.model('Workspace');
const Transaction = mongoose.model('Transaction');
const CompanyLogin = mongoose.model('CompanyLogin');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const bcrypt = require('bcrypt');
const mailchimp = require('@mailchimp/mailchimp_marketing');
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});


function generateVerificationCode(length) {
  const characters = '0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

function generateApiKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = '';
  for (let i = 0; i < 32; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    apiKey += chars[randomIndex];
  }
  return apiKey;
}


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let ban = false;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (ip === "5.173.138.116" || ip === "89.187.232.155") {
      ban = true;
    }
    await user.comparePassword(password);
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    if (user.workspace) {
      const login = new CompanyLogin({ workspaceId: user.workspace });
      await login.save();
    }
    user.ip = ip;
    user.lastSeen = Date.now();
    await user.save();
    return res.json({ token, user, ban });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, isCompany } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      // User already exists, log them in
      await user.comparePassword(password);
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return res.status(200).json({ token, user });
    }

    const verificationCode = generateVerificationCode(6);

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

    let newUser = new User({
      email,
      password,
      name,
      accountType: "company",
      isCopmany: true,
      verificationCode,
      isBlocked: false,
      ip
    });

      const key = generateApiKey();
      let workspace = new Workspace({
        admins: [newUser._id],
        company: newUser._id,
        employees: [],
        apiKey: key
      });
      await workspace.save();
      newUser.workspace = workspace._id;

    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.status(201).json({ token, user: newUser });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/update-employee-details', async (req, res) => {
  try {
      // Fetch the workspace by its ID
      const workspace = await Workspace.findById(req.body.workspaceId);
      
      if (!workspace) {
          return res.status(404).send({ message: "Workspace not found" });
      }

      // Update the name and email of each employee based on their associated user document
      const updatePromises = workspace.employees.map(async employee => {
          const user = await User.findById(employee.user);
          if (user) {
              employee.name = user.name;
              employee.email = user.email;
          }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Save the updated workspace
      await workspace.save();

      res.send({ message: "Employee details updated successfully", workspace });
  } catch (error) {
      res.status(500).send({ message: "An error occurred", error });
  }
});


router.post('/register-free-trial', async (req, res) => {
  try {
      const { email, password, name, referrerId, blockAccess } = req.body;
      const user = await User.findOne({ email });
      let freeTokens = 25000;
      let ban = false;

      if (user) {
        // User already exists, log them in
        await user.comparePassword(password);
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.status(200).json({ token, user });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (ip === "5.173.138.116") {
        ban = true;
        freeTokens = 0;
      }
      
      const verificationCode = generateVerificationCode(6);

      const newUser = new User({
          email,
          password,
          name,
          accountType: "company",
          isCompany: true,
          referredBy: referrerId,
          verificationCode,
          plan: "647c3294ff40f15b5f6796bf",
          ip
      });

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

        const key = generateApiKey();
        let createdWorkspace = new Workspace({
          admins: [newUser._id],
          company: newUser._id,
          employees: [],
          apiKey: key
        });

      if (blockAccess) {
        newUser.dashboardAccess = false;
      }
      await createdWorkspace.save();
      newUser.workspace = createdWorkspace._id;
      freeTokens = 25000;

      let transaction = new Transaction({
        value: freeTokens,
        title: `+${freeTokens} trial elixir`,
        type: "income",
        timestamp: Date.now()
      });
      newUser.tokenBalance = freeTokens;
      newUser.transactions.push(transaction);
      await transaction.save();
      await newUser.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.status(201).json({ newUser, verificationCode, token, ban });
  } catch (error) {
      return res.status(500).json({ message: error.message });
  }
});


router.post('/register-no-password', async (req, res) => {
  try {
    const { email, name, isCompany } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      // User already exists, check if they have a workspace and if not create one
      if(!user.workspace) {
        const key = generateApiKey();
        let workspace = new Workspace({
          admins: [user._id],
          company: user._id,
          employees: [],
          apiKey: key
        });
        await workspace.save();
        user.workspace = workspace._id;
        user.accountType = 'company';
        await user.save();
      }
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.status(200).json({ token, user });
    }

    let accountType = 'individual';
    if (isCompany) {
      accountType = 'company';
    }

    const verificationCode = generateVerificationCode(6);

    const newUser = new User({
      email,
      password: verificationCode,
      name,
      accountType,
      isBlocked: true,
    });

    if (isCompany) {
      const key = generateApiKey();
      let workspace = new Workspace({
        admins: [newUser._id],
        company: newUser._id,
        employees: [],
        apiKey: key
      });
      await workspace.save();
      newUser.workspace = workspace._id;
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

    let transaction = new Transaction({
      value: 2500,
      title: "+2500 elixiru na start",
      type: "income",
      timestamp: Date.now()
    });

    newUser.tokenBalance += 2500;
    newUser.transactions.push(transaction);
    await transaction.save();
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.status(201).json({ token, user: newUser, verificationCode });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/register-to-workspace', async (req, res) => {
  try {
    const { email, password, name, workspaceId } = req.body;
    let employee = null;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Invalid workspace ID' });
    }

    // Find the invitation with the provided email address in the workspace invitations array
    const invitation = workspace.invitations.find(i => i.email === email);
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid email address' });
    }

    const user = await User.findOne({ email });

    if (!user) {
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

      employee = await User.create({ email, password, name, accountType: 'individual', workspace: workspace.id, isBlocked: false, plan: null });
      await employee.save();

    } else {
      await user.comparePassword(password);
      employee = user;
      user.plan = null;
      user.workspace = workspace._id;
      await user.save();
    }

    workspace.employees.push({ user: employee, role: invitation.role, name: employee.name , email: employee.email});
    workspace.invitations = workspace.invitations.filter(i => i.email !== email);
    await workspace.save();
    const token = jwt.sign({ userId: employee._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.status(200).json({ token, newUser: employee });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});


router.post('/verify-email', async (req, res) => {
  try {
    const { email, code, name } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verificationCode === code) {
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
      user.isBlocked = false;
      await user.save();
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
      res.status(200).json({ newUser: user, token });
    } else {
      res.status(400).json({ message: 'Invalid verification code' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/save-contact', async (req, res) => {
  try {
    const { email, name, companyName, phone, preorder } = req.body;
      try {
        await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID, {
          email_address: email,
          status: 'subscribed',
          merge_fields: {
            FNAME: name,
            COMPANY: companyName,
            PHONE: phone,
            PRO: preorder
          },
        });
      } catch (error) {
        console.error('Failed to add user to Mailchimp audience:', error.message);
      }
      res.status(200).json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
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
      const refreshToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
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
    const resetLink = `https://www.yepp.ai/password-reset-confirm?token=${token}&userId=${user._id}`;
    return res.status(200).json({ link: resetLink, name: user.name });
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
  

  router.patch('/password-reset-admin', requireAdmin, async (req, res) => {
    const user = await User.findById(req.body.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.body.password) {

      if (req.body.password.startsWith('$2')){
        return res.status(5000).json({ message: 'Error' });
      }
      
      bcrypt.genSalt(10, (err, salt) => {
  
          if (err){
            return res.status(5000).json({ message: 'Error' });
          }
  
          bcrypt.hash(req.body.password, salt, async (err, hash) => {
  
              if (err){
                return res.status(5000).json({ message: 'Error' });
              }
  
              user.password = hash;
              await user.save();
              return res.status(200).json({ message: 'Password updated' });
          })
      })

    }
  })
  

module.exports = router;