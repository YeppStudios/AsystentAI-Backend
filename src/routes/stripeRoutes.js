const express = require('express');
require('dotenv').config()
const bodyParser = require('body-parser');
const requireAuth = require('../middlewares/requireAuth');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');
const axios = require('axios');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const purchaseEndpointSecret = 'whsec_NKIX7ahLbstNif0WGd7AIsIy170RqOzc';
const subscriptionEndpointSecret = 'whsec_NInmuuTZVfBMnfTzNFZJTl0I67u62GCz';
const infaktConfig = {
  headers: {
    'X-inFakt-ApiKey': `${process.env.INFAKT_KEY}`,
    'Content-Type': 'application/json',
  },
};

const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
  const { priceId, mode, successURL, cancelURL, email, tokensAmount, planId } = req.body;
  try {
      let customer = await stripe.customers.list({ email: email, limit: 1 });
      if (customer.data.length > 0) {
          // Use existing customer object
          customer = customer.data[0];
      } else {
          // Create new customer object
          customer = await stripe.customers.create({
              email: email
          });
      }
      const session = await stripe.checkout.sessions.create({
          customer: customer.id,
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
      User.findOne({ email: transactionData.customer_details.email }, async (err, user) => {

        if(user){
          let transaction;
          let purchase;
          let invoiceData;
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const name = user.fullName;
          const lastName = name.split(" ")[1];
          const firstname = name.split(" ")[0];
          console.log(transactionData.metadata.plan_id)
          if (transactionData.metadata.plan_id) { //initial subscription purchase
            try {
              const planId = transactionData.metadata.plan_id;
              const plan = await Plan.findById(planId);
              user.plan = plan;
              user.tokenBalance += plan.monthlyTokens;

              // Create a new purchase
              purchase = new Payment({
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

              if(!(user.companyName.trim().length === 0)){
                invoiceData = { //for companies
                  invoice: {
                    "client_company_name": user.companyName, 
                    "invoice_date": `${year}-${month}-${day}`,
                    "sale_date": `${year}-${month}-${day}`,
                    "payment_method": "card",
                    "status": "paid",
                    "paid_date": `${year}-${month}-${day}`,
                    "client_first_name": firstname,
                    "client_last_name": lastName,
                    "client_street": user.street,
                    "client_street_number": user.apartmentNumber,
                    "client_city": user.city,
                    "client_post_code": user.postalCode,
                    "client_tax_code": user.nip,
                    "client_country": "Polska",
                    "paid_price": plan.price * 100, 
                    "services":[
                      {
                         "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`, 
                         "pkwiu": "62.01", 
                         "tax_symbol": 23,
                         "gross_price": plan.price * 100, 
                      }
                    ]
                  },
                };
              } else { //for individuals
                invoiceData = {
                  invoice: {
                    "client_company_name": user.fullName, 
                    "invoice_date": `${year}-${month}-${day}`,
                    "sale_date": `${year}-${month}-${day}`,
                    "status": "paid",
                    "paid_date": `${year}-${month}-${day}`,
                    "payment_method": "card",
                    "client_first_name": firstname,
                    "client_last_name": lastName,
                    "client_street": user.street,
                    "client_street_number": user.apartmentNumber,
                    "client_city": user.city,
                    "client_post_code": user.postalCode,
                    "client_country": "Polska",
                    "paid_price": plan.price * 100, 
                    "client_tax_code": "",
                    "services":[
                      {
                         "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`,
                         "pkwiu": "62.01", 
                         "tax_symbol": 23,
                         "gross_price": plan.price * 100, 
                      }
                    ]
                  },
                };
              }
            } catch (err) {
              return response.status(400).send(`Webhook Error: ${err.message}`);
            }

          } else { //one-time purchase
            const tokensToAdd = parseInt(transactionData.metadata.tokens_to_add);
            user.tokenBalance += tokensToAdd;

            // Create a new purchase
            purchase = new Payment({
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

          //generate infakt invoice object
          if(!(user.companyName.trim().length === 0)){
            invoiceData = { //for companies
              invoice: {
                "client_company_name": user.companyName, 
                "invoice_date": `${year}-${month}-${day}`,
                "sale_date": `${year}-${month}-${day}`,
                "status": "paid",
                "paid_date": `${year}-${month}-${day}`,
                "payment_method": "card",
                "client_first_name": firstname,
                "client_last_name": lastName,
                "client_street": user.street,
                "client_street_number": user.apartmentNumber,
                "client_city": user.city,
                "client_post_code": user.postalCode,
                "client_tax_code": user.nip,
                "client_country": "Polska",
                "paid_price": transactionData.amount_total, 
                "services":[
                  {
                     "name": `Jednorazowe doładowanie miesięcznej Subskrypcji - "Elixir ${tokensToAdd}ml`, 
                     "pkwiu": "62.01", 
                     "tax_symbol": 23,
                     "gross_price": transactionData.amount_total, 
                  }
                ]
              },
            };
          } else { //for individuals
            invoiceData = {
              invoice: {
                "client_company_name": user.fullName, 
                "invoice_date": `${year}-${month}-${day}`,
                "sale_date": `${year}-${month}-${day}`,
                "status": "paid",
                "paid_date": `${year}-${month}-${day}`,
                "payment_method": "card",
                "client_first_name": firstname,
                "client_last_name": lastName,
                "client_street": user.street,
                "client_street_number": user.apartmentNumber,
                "client_city": user.city,
                "client_post_code": user.postalCode,
                "client_country": "Polska",
                "paid_price": transactionData.amount_total, 
                "client_tax_code": "",
                "services":[
                  {
                    "name": `Jednorazowe doładowanie miesięcznej Subskrypcji - "Elixir ${tokensToAdd}ml`,
                     "pkwiu": "62.01", 
                     "tax_symbol": 23,
                     "gross_price": transactionData.amount_total, 
                  }
                ]
              },
            };
          }

          }

          // Create a new balance snapshot and add it to the user's tokenHistory
          const balanceSnapshot = {
              timestamp: Date.now(),
              balance: user.tokenBalance
          };
          user.tokenHistory.push(balanceSnapshot);

          // Save the user and send invoice
          try {
            await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await user.save();
            await transaction.save();
            await purchase.save();
            const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
            const lastInvoiceID = latestInvoice.data.entities[0].id;
            await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/paid.json`, {invoice: {"status": "paid"}}, infaktConfig);
            await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
          } catch (error) {
            console.error(`Error: ${JSON.stringify(error.response.data)}`);
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

  if (event.type === 'invoice.paid' && event.data.object.billing_reason === 'subscription_cycle') {
    try {

    User.findOne({ email: transactionData.customer_details.email }, async (err, user) => {
      if(user) {
        
        let transaction;
        let invoiceData;

        try {
          const planId = transactionData.metadata.plan_id;
          const plan = await Plan.findById(planId);

          user.tokenBalance += plan.monthlyTokens;
  
          // Create a new transaction
          transaction = new Transaction({
              value: plan.monthlyTokens,
              title: `Miesięczne doładowanie ${plan.monthlyTokens} tokenów`,
              type: 'income',
              timestamp: Date.now()
          });
          user.transactions.push(transaction);

          //generate infakt invoice for first subscription payment
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const name = user.fullName;
          const lastName = name.split(" ")[1];
          const firstname = name.split(" ")[0]; 

          if(!(user.companyName.trim().length === 0)){
            invoiceData = { //for companies
              invoice: {
                "client_company_name": user.companyName, 
                "invoice_date": `${year}-${month}-${day}`,
                "sale_date": `${year}-${month}-${day}`,
                "status": "paid",
                "paid_date": `${year}-${month}-${day}`,
                "payment_method": "card",
                "client_first_name": firstname,
                "client_last_name": lastName,
                "client_street": user.street,
                "client_street_number": user.apartmentNumber,
                "client_city": user.city,
                "client_post_code": user.postalCode,
                "client_tax_code": user.nip,
                "client_country": "Polska",
                "paid_price": plan.price * 100, 
                "services":[
                  {
                     "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`, 
                     "pkwiu": "62.01", 
                     "tax_symbol": 23,
                     "gross_price": plan.price * 100, 
                  }
                ]
              },
            };
          } else { //for individuals
            invoiceData = {
              invoice: {
                "client_company_name": user.fullName, 
                "invoice_date": `${year}-${month}-${day}`,
                "sale_date": `${year}-${month}-${day}`,
                "status": "paid",
                "paid_date": `${year}-${month}-${day}`,
                "payment_method": "card",
                "client_first_name": firstname,
                "client_last_name": lastName,
                "client_street": user.street,
                "client_street_number": user.apartmentNumber,
                "client_city": user.city,
                "client_post_code": user.postalCode,
                "client_country": "Polska",
                "paid_price": plan.price * 100, 
                "client_tax_code": "",
                "services":[
                  {
                     "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`, 
                     "pkwiu": "62.01", 
                     "tax_symbol": 23,
                     "gross_price": plan.price * 100, 
                  }
                ]
              },
            };
          }

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
          await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await user.save();
          await transaction.save();
          const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
          const lastInvoiceID = latestInvoice.data.entities[0].id;
          await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/paid.json`, {invoice: {"status": "paid"}}, infaktConfig);
          await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
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


router.post('/cancel-subscription', requireAuth, async (req, res) => {
  const user = req.user;
  try {
    const customer = await stripe.customers.list({ email: user.contactEmail });
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.data[0].id,
    });
    const currentSubscriptionID = subscriptions.data[0].id;
    const deleted = await stripe.subscriptions.del(
      currentSubscriptionID
    );
    await User.updateOne({ _id: user._id }, { plan: null });
    
    res.status(200).json({ message: "Subscription cancelled", deletedSubscription: deleted });
  } catch (e) {
  res.status(500).json({message: "Error cancelling subscripiton", error: e})
  }
});


router.post('/update-subscription', requireAuth, async (req, res) => {
  const user = req.user;
  const { priceId, planId } = req.body;

  try {
    const customer = await stripe.customers.list({ email: user.contactEmail });
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.data[0].id,
    });

    if(subscriptions.data.length > 0){
      await stripe.subscriptions.del( //delete previous subscription
        subscriptions.data[0].id
      );
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); //wait for stripe
    
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.data[0].id,
      type: 'card',
    });

    const subscription = await stripe.subscriptions.create({ //subscribe to new price
      customer: customer.data[0].id,
      default_payment_method: paymentMethods.data[0].id, // use the first card in the list
      items: [
        {price: `${priceId}`},
      ],
    });

    const plan = await Plan.findById(planId);
    user.plan = plan;
    user.tokenBalance += plan.monthlyTokens;

    const purchase = new Payment({
        price: plan.price,
        tokens: plan.monthlyTokens,
        title: `Aktywacja subskrypcji ${plan.name}`,
        type: "one-time",
        timestamp: new Date()
    });
    user.purchases.push(purchase);

    const transaction = new Transaction({
        value: plan.monthlyTokens,
        title: `Aktywacja subskrypcji ${plan.name}`,
        type: 'income',
        timestamp: Date.now()
    });
    user.transactions.push(transaction);
    
    let invoiceData;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const name = user.fullName;
    const lastName = name.split(" ")[1];
    const firstname = name.split(" ")[0];
    if(!(user.companyName.trim().length === 0)){
      invoiceData = { //for companies
        invoice: {
          "client_company_name": user.companyName, 
          "invoice_date": `${year}-${month}-${day}`,
          "sale_date": `${year}-${month}-${day}`,
          "payment_method": "card",
          "status": "paid",
          "paid_date": `${year}-${month}-${day}`,
          "client_first_name": firstname,
          "client_last_name": lastName,
          "client_street": user.street,
          "client_street_number": user.apartmentNumber,
          "client_city": user.city,
          "client_post_code": user.postalCode,
          "client_tax_code": user.nip,
          "client_country": "Polska",
          "paid_price": plan.price * 100, 
          "services":[
            {
               "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`, 
               "pkwiu": "62.01", 
               "tax_symbol": 23,
               "gross_price": plan.price * 100, 
            }
          ]
        },
      };
    } else { //for individuals
      invoiceData = {
        invoice: {
          "client_company_name": user.fullName, 
          "invoice_date": `${year}-${month}-${day}`,
          "sale_date": `${year}-${month}-${day}`,
          "status": "paid",
          "paid_date": `${year}-${month}-${day}`,
          "payment_method": "card",
          "client_first_name": firstname,
          "client_last_name": lastName,
          "client_street": user.street,
          "client_street_number": user.apartmentNumber,
          "client_city": user.city,
          "client_post_code": user.postalCode,
          "client_country": "Polska",
          "paid_price": plan.price * 100, 
          "client_tax_code": "",
          "services":[
            {
               "name": `Miesięczna Subskrypcja Oprogramowania Aplikacji AsystentAI (Pakiet ${plan.name})`,
               "pkwiu": "62.01", 
               "tax_symbol": 23,
               "gross_price": plan.price * 100, 
            }
          ]
        },
      };
    }
    const balanceSnapshot = {
      timestamp: Date.now(),
      balance: user.tokenBalance
    };
    user.tokenHistory.push(balanceSnapshot);

    try {
      await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await user.save();
      await transaction.save();
      await purchase.save();
      const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
      const lastInvoiceID = latestInvoice.data.entities[0].id;
      await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/paid.json`, {invoice: {"status": "paid"}}, infaktConfig);
      await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
    } catch (error) {
      console.error(`Error: ${JSON.stringify(error.response.data)}`);
    }

    res.status(200).json({ message: "Subscription updated", subscription });
} catch (e) {
  res.status(500).json({message: "Error updating subscripiton", error: e})
}
});


module.exports = router;