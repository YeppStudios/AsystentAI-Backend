const express = require('express');
require('dotenv').config()
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const purchaseEndpointSecret = 'whsec_NKIX7ahLbstNif0WGd7AIsIy170RqOzc';
const subscriptionEndpointSecret = 'whsec_aHNEFJ3R9CIuNn2H96jzm8wlMwGbKp97';

const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
    const { priceId, mode, successURL, cancelURL, email, tokensAmount, planId } = req.body;
    try {
      const session = await stripe.checkout.sessions.create({
        customer_email: `${email}`,
        line_items: [
          {
            price: `${priceId}`,
            quantity: 1,
          },
        ],
        metadata: {
          tokens_to_add: `${tokensAmount}`,
          plan_id: `${planId}`//plan id
        },
        mode: `${mode}`,
        success_url: `${successURL}`,
        cancel_url: `${cancelURL}`,
        automatic_tax: {enabled: true},
      });

      res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({message: "Error creating session for price"})
  }
});


//listening for one-time purchases as well as first payment of subscription
router.post('/one-time-checkout-webhook', bodyParser.raw({type: 'application/json'}), async (request, response) => {
  const payload = request.rawBody;
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, purchaseEndpointSecret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }
  const transactionData = event.data.object;

  if (event.type === 'checkout.session.completed') {
    try{
      User.findOne({ email: transactionData.customer_email }, async (err, user) => {

        if(user){

          let transaction;

          if (transactionData.metadata.plan_id) { //initial subscription purchase
            try {
              const planId = transactionData.metadata.plan_id;
              const plan = await Plan.findById(planId);
              user.plan = plan;
              user.tokenBalance += plan.monthlyTokens;

              // Create a new purchase
              const purchase = new Payment({
                price: plan.price,
                tokens: plan.monthlyTokens,
                title: `Aktywacja subskrypcji ${plan.name}`,
                type: "one-time",
                timestamp: new Date()
              });
              user.purchases.push(purchase);

              // Create a new transaction
              transaction = new Transaction({
                  value: plan.monthlyTokens,
                  title: `Aktywacja subskrypcji ${plan.name}`,
                  type: 'income',
                  timestamp: Date.now()
              });
              user.transactions.push(transaction);
            } catch (err) {
              return response.status(400).send(`Webhook Error: ${err.message}`);
            }

          } else { //one-time purchase
            const tokensToAdd = parseInt(transactionData.metadata.tokens_to_add);
            user.tokenBalance += tokensToAdd;

            // Create a new purchase
            const purchase = new Payment({
              price: transactionData.amount_total / 100,
              tokens: tokensToAdd,
              title: `Doładowanie ${tokensToAdd} tokenów`,
              type: "one-time",
              timestamp: new Date()
            });
            user.purchases.push(purchase);

            // Create a new transaction
            transaction = new Transaction({
                value: tokensToAdd,
                title: `Doładowanie ${tokensToAdd} tokenów`,
                type: 'income',
                timestamp: Date.now()
            });
            user.transactions.push(transaction);
          }

          // Create a new balance snapshot and add it to the user's tokenHistory
          const balanceSnapshot = {
              timestamp: Date.now(),
              balance: user.tokenBalance
          };
          user.tokenHistory.push(balanceSnapshot);

          // Save the user
          try {
            await user.save();
            await transaction.save();
          } catch (error) {
            console.error(`Error saving user: ${error.message}`);
          }
        }
      });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  }

  response.status(200).send('Webhook received');
});


//listening for subscription renewals
router.post('/subscription-checkout-webhook', bodyParser.raw({type: 'application/json'}), async (request, response) => {
  const payload = request.rawBody;
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, subscriptionEndpointSecret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }
  const transactionData = event.data.object;

  if (event.type === 'invoice.payment_succeeded') {
    try {
    User.findOne({ email: transactionData.customer_email }, async (err, user) => {
      if(user) {
        let transaction;
        try {
          const planId = transactionData.metadata.plan_id;
          const plan = await Plan.findById(planId);

          user.tokenBalance += plan.monthlyTokens;
  
          // Create a new transaction
          transaction = new Transaction({
              value: plan.monthlyTokens,
              title: `Miesięczne doładowanie ${tokensToAdd} tokenów`,
              type: 'income',
              timestamp: Date.now()
          });
          user.transactions.push(transaction);

        } catch (error) {
          console.error(`Error saving user: ${error.message}`);
        }


        // Create a new balance snapshot and add it to the user's tokenHistory
        const balanceSnapshot = {
            timestamp: Date.now(),
            balance: user.tokenBalance
        };
        user.tokenHistory.push(balanceSnapshot);

        // Save the user
        try {
          await user.save();
          await transaction.save();
        } catch (error) {
          console.error(`Error saving user: ${error.message}`);
        }
      }
    });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  } 

  response.status(200).send('Webhook received');
});

module.exports = router;