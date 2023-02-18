const express = require('express');
require('dotenv').config()
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');

const stripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
const endpointSecret = 'whsec_fe0e42230aa34c7144b0e88040ddf05780490aba5b7cfc9d1e5e0df0213fbdd8';

const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
    const { priceId, mode, successURL, cancelURL, email, tokensAmount } = req.body;
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
      },
      mode: `${mode}`,
      success_url: `${successURL}`,
      cancel_url: `${cancelURL}`,
      automatic_tax: {enabled: true},
    });

    res.status(200).json({ url: session.url });
});

router.post('/webhook', bodyParser.raw({type: 'application/json'}), async (request, response) => {
  const payload = request.rawBody;
  const parsedPayload = request.body;
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const transactionData = event.data.object;
    User.findOne({ email: transactionData.customer_email }, async (err, user) => {
      if(user){
        console.log(user)
        console.log(transactionData.metadata.tokens_to_add)

        // Add tokens to user's balance
        const tokensToAdd = parseInt(transactionData.metadata.tokens_to_add);
        user.tokenBalance += tokensToAdd;

        // Create a new purchase
        const purchase = new Payment({
            price: transactionData.amount_total / 100,
            tokens: tokensToAdd,
            title: 'Stripe Purchase',
            type: "one-time",
            timestamp: new Date()
        });

        user.purchases.push(purchase);

        // Create a new transaction
        const transaction = new Transaction({
            value: tokensToAdd,
            title: `Doładowanie ${tokensToAdd} tokenów`,
            type: 'income',
            timestamp: Date.now()
        });

        user.transactions.push(transaction);

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
  }

  response.status(200).send('Webhook received');
});

module.exports = router;