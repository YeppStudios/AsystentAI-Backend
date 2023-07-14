const express = require('express');
require('dotenv').config()
const bodyParser = require('body-parser');
const requireAuth = require('../middlewares/requireAuth');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');
const Whitelist = mongoose.model('Whitelist');
const Workspace = mongoose.model('Workspace');
const Document = mongoose.model('Document');
const Folder = mongoose.model('Folder');
const axios = require('axios');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const purchaseEndpointSecret = 'whsec_VIcwCMNdNcXotMOrZCrIwrbptD0Vffdj';
const subscriptionEndpointSecret = 'whsec_NInmuuTZVfBMnfTzNFZJTl0I67u62GCz';
const infaktConfig = {
  headers: {
    'X-inFakt-ApiKey': `${process.env.INFAKT_KEY}`,
    'Content-Type': 'application/json',
  },
};

const router = express.Router();

function generateApiKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = '';
  for (let i = 0; i < 32; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    apiKey += chars[randomIndex];
  }
  return apiKey;
}


router.post('/create-checkout-session', async (req, res) => {
  const { priceId, mode, successURL, cancelURL, email, tokensAmount, planId, referrerId, global, asCompany, invoiceTitle, months, trial } = req.body;
  try {
    let customer;
    try {
      const customerList = await stripe.customers.list({ email: email, limit: 1 });
      if (customerList.data.length > 0) {
        customer = customerList.data[0];
      } else {
        customer = await stripe.customers.create({
          email: email
        });
      }

    } catch (e) {
      console.log(e)
    }

    let session;
    if (global) {
      if (trial) {
        session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price: `${priceId}`,
              quantity: 1,
            },
          ],
          metadata: {
            tokens_to_add: `${tokensAmount}`,
            plan_id: `${planId}`,
            referrer_id: `${referrerId}`,
            months,
            trial: true
          },
          subscription_data: {
            trial_period_days: 5,
          },
          allow_promotion_codes: true,
          automatic_tax: {
            enabled: true,
          },
          tax_id_collection: {
            enabled: true,
          },
          customer_email: email,
          mode: `${mode}`,
          success_url: `${successURL}`,
          cancel_url: `${cancelURL}`,
        });
      } else if (mode === "payment") {
        session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price: `${priceId}`,
              quantity: 1,
            },
          ],
          metadata: {
            tokens_to_add: `${tokensAmount}`,
            plan_id: `${planId}`,
            referrer_id: `${referrerId}`,
            months
          },
          invoice_creation: {
            enabled: true,
          },
          customer: customer.id,
          automatic_tax: {
            enabled: true,
          },
          mode: `${mode}`,
          success_url: `${successURL}`,
          cancel_url: `${cancelURL}`,
        });
      } else if (mode === "subscription") { 
        session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price: `${priceId}`,
              quantity: 1,
            },
          ],
          metadata: {
            tokens_to_add: `${tokensAmount}`,
            plan_id: `${planId}`,
            infaktInvoice: asCompany,
            invoiceTitle: invoiceTitle,
            referrer_id: `${referrerId}`,
            months
          },
          allow_promotion_codes: true,
          automatic_tax: {
            enabled: true,
          },
          tax_id_collection: {
            enabled: true,
          },
          customer_email: email,
          mode: `${mode}`,
          success_url: `${successURL}`,
          cancel_url: `${cancelURL}`,
        });
      }  
    } else {
      session = await stripe.checkout.sessions.create({
        customer: customer.id,
        line_items: [
          {
            price: `${priceId}`,
            quantity: 1,
          },
        ],
        metadata: {
          tokens_to_add: `${tokensAmount}`,
          plan_id: `${planId}`,
          referrer_id: `${referrerId}`,
          trial: false,
          months,
          infaktInvoice: asCompany,
          invoiceTitle: invoiceTitle
        },
        mode: `${mode}`,
        success_url: `${successURL}`,
        cancel_url: `${cancelURL}`,
      });
    }
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ message: "Error creating session for price" });
    console.log(e);
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
    let email = transactionData.customer_details.email;
    try{
      User.findOne({ email: email }, async (err, user) => {
        if(user){
          let transaction;
          let purchase;
          let invoiceData;
          let infaktClientId;
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');

          user.dashboardAccess = true;

          //set or delete workspace for subscription activation
          if (transactionData.metadata.plan_id !== "64ad0d250e40385f299bceea" && user.workspace && transactionData.metadata.plan_id) {
            const workspace = await Workspace.findById(user.workspace);
            if (workspace) {
              const isCompany = workspace.company.includes(user._id);
            
              if (isCompany) {
                const workspaceUsers = [
                    ...workspace.admins,
                    ...workspace.company,
                    ...workspace.employees.map(employee => employee.user)
                ];
                for (const userId of workspaceUsers) {
                    const workspaceUser = await User.findById(userId);
                    if (userId !== user._id) {
                      workspaceUser.plan = "647c3294ff40f15b5f6796bf";
                    }
                    workspaceUser.workspace = null;
                    await workspaceUser.save();
                }
                await Workspace.deleteOne({ _id: workspace._id });
              }
              user.workspace = null;
            }
            // Find the user's folders and remove them
            await Folder.deleteMany({ owner: user._id });

            // Find the user's documents and remove them
            await Document.deleteMany({ owner: user._id });
          } else if (!user.workspace && (transactionData.metadata.plan_id === "64ad0d250e40385f299bceea" || transactionData.metadata.plan_id === "647c3294ff40f15b5f6796bf")) {
            const key = generateApiKey();
            let workspace = new Workspace({
              admins: [user._id],
              company: user._id,
              employees: [],
              apiKey: key
            });
            await workspace.save();
            user.workspace = workspace._id;
          }

          //add tokens if trial
          if (transactionData.metadata.trial) {
            user.tokenBalance += 25000;
            user.plan = "647c3294ff40f15b5f6796bf";
            
          } else {
            if (transactionData.metadata.plan_id) { //handle initial subscription purchase
              try {
                const planId = transactionData.metadata.plan_id;
                const plan = await Plan.findById(planId);
                user.plan = plan;
                user.tokenBalance += plan.monthlyTokens*Number(transactionData.metadata.months);
  
                if(transactionData.metadata.trial){
                  await Whitelist.deleteOne({ email });
                }
  
                // Create a new purchase
                purchase = new Payment({
                  price: plan.price,
                  tokens: plan.monthlyTokens,
                  title: `${plan.name} plan activated`,
                  type: "one-time",
                  timestamp: new Date()
                });
                user.purchases.push(purchase);
  
                // Create a new transaction
                transaction = new Transaction({
                    value: plan.monthlyTokens,
                    title: `${plan.name} plan activated`,
                    type: 'income',
                    timestamp: Date.now()
                });
                const balanceSnapshot = {
                  timestamp: Date.now(),
                  balance: user.tokenBalance
                };
                user.tokenHistory.push(balanceSnapshot);
                user.transactions.push(transaction);
                await transaction.save();
                await purchase.save();
  
                //checking if transaction was referred
                if (transactionData.metadata.referrer_id && transactionData.metadata.plan_id === "64ad0d250e40385f299bceea") {
                try {
                  const referrer = await User.findOne({ _id: transactionData.metadata.referrer_id });
                  if(referrer){
                    user.tokenBalance += 30000;
                    referrer.tokenBalance += 30000;
        
                    const referralTransaction = new Transaction({
                        value: 30000,
                        title: "30 000 elixir for referral",
                        type: "income",
                        timestamp: Date.now()
                    });
  
                    user.transactions.push(referralTransaction);
                    referrer.transactions.push(referralTransaction);
        
                    const referrerBalanceSnapshot = {
                      timestamp: new Date(),
                      balance: referrer.tokenBalance
                    };
                    referrer.tokenHistory.push(referrerBalanceSnapshot);
        
                    User.findOneAndUpdate(
                      { _id: transactionData.metadata.referrer_id },
                      { $inc: { "referralCount": 1 } },
                      { upsert: true },
                      function(err, user) {
                        if (err) throw err;
                      }
                    );
                    await referrer.save();
                    await referralTransaction.save();
                  }
                } catch (e) {
                  console.log(e)
                }
              }
              } catch (err) {
                console.log(err)
              }
  
            } else if (transactionData.metadata.tokens_to_add !== "undefined") { //one-time elixir purchase
              const tokensToAdd = parseInt(transactionData.metadata.tokens_to_add);
              user.tokenBalance += tokensToAdd;
  
              // Create a new purchase
              purchase = new Payment({
                price: transactionData.amount_total / 100,
                tokens: tokensToAdd,
                title: `+ ${tokensToAdd} tokens`,
                type: "one-time",
                timestamp: new Date()
              });
              user.purchases.push(purchase);
  
              // Create a new transaction
              transaction = new Transaction({
                  value: tokensToAdd,
                  title: `+ ${tokensToAdd} tokens`,
                  type: 'income',
                  timestamp: Date.now()
              });
              const balanceSnapshot = {
                timestamp: Date.now(),
                balance: user.tokenBalance
            };
            user.tokenHistory.push(balanceSnapshot);
              user.transactions.push(transaction);
              await transaction.save();
              await purchase.save();
            }
          }
          await user.save();
          // Save the user and send invoice
          try {
            if (user.accountType === "company" && transactionData.metadata.infaktInvoice === "true") {
              //check if client is in infakt if not then create new one
                try {
                  let infaktClientsResponse = await axios.get(`https://api.infakt.pl/v3/clients.json?q[email_eq]=${user.contactEmail}`, infaktConfig);
                  let infaktClients = infaktClientsResponse.data;
                  if (infaktClients.length > 0) {
                    infaktClientId = infaktClients[0].id;
                  } else {
                    let createdInfaktClient = await axios.post('https://api.infakt.pl/v3/clients.json', {
                      client: {
                        "name": user.fullName,
                        "email": user.email,
                        "company_name": user.companyName,
                        "street": user.street,
                        "street_number": user.streetNumber,
                        "flat_number": user.apartmentNumber,
                        "city": user.city,
                        "country": "Polska",
                        "postal_code": user.postalCode,
                        "nip": user.nip,
                        "mailing_company_mail": user.contactEmail
                      }
                    }, infaktConfig);
                    infaktClientId = createdInfaktClient.data.id;
                  }            
                  invoiceData = {
                    invoice: {
                      "client_company_name": user.companyName, 
                      "invoice_date": `${year}-${month}-${day}`,
                      "sale_date": `${year}-${month}-${day}`,
                      "status": "paid",
                      "paid_date": `${year}-${month}-${day}`,
                      "payment_method": "card",
                      "client_id": infaktClientId,
                      "paid_price": transactionData.amount_total, 
                      "services":[
                        {
                          "name": `${transactionData.metadata.invoiceTitle}`, 
                          "pkwiu": "62.01", 
                          "tax_symbol": 23,
                          "gross_price": transactionData.amount_total, 
                        }
                      ]
                    },
                  };
                } catch (e) {
                  console.log(e);
                }

              await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
              await new Promise(resolve => setTimeout(resolve, 3000));
              const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
              const lastInvoiceID = latestInvoice.data.entities[0].uuid;
              // await axios.post(`https://api.infakt.pl/api/v3/invoices/${lastInvoiceID}/paid.json`, {}, infaktConfig);
              await axios.post(`https://api.infakt.pl/api/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
            }
          } catch (error) {
            console.error(error);
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

  if (event.type === 'invoice.paid' && event.data.object.billing_reason === 'subscription_cycle') {
    try {
    const userEmail = event.data.object.customer_email;
    User.findOne({ email: userEmail }, async (err, user) => {
      if(user) {
        
        let transaction;
        let invoiceData;
        let infaktClientId;
        let planId;
        let priceId = event.data.object.lines.data[0].price.id;

        try {
          if(priceId === "price_1MdbTMFe80Kn2YGG5QDfmjvS") { //Basic Monthly price
            planId = "63f0e6968e1b9d507c38a749";
          } else if (priceId === "price_1MdbUeFe80Kn2YGGRlKvmre4") { //Assistant Monthly price (old)
            planId = "63f0e7d075de0ef12bb8c484";
          } else if (priceId === "price_1NFwcqFe80Kn2YGGi4iIulhc") {
            planId = "647895cf404e31bfe8753398";
          } else if (priceId === "price_1NFwxWFe80Kn2YGGvpHuUfpi") { //Assistant Pro Monthly
            planId = "6478970a404e31bfe87533a0"
          } else if (priceId === "price_1MzNh9Fe80Kn2YGGkv8OaQ0T") { //Assistant Business Monthly
            planId = "6444d4394ab2cf9819e5b5f4"
          } else if (priceId === "price_1NFx0EFe80Kn2YGGCWikSSti") { //Assistant Business Monthly Full Price
            planId = "6444d4394ab2cf9819e5b5f4"
          } else if (priceId === "price_1NSZghFe80Kn2YGGOiClJUPM") { //Agency Monthly Full Price
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSai5Fe80Kn2YGGHrwmUEqe") { //Agency 3mo
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSaiNFe80Kn2YGGG88egvhI") { //Agency 6mo
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSaieFe80Kn2YGGilwS3SNl") { //Agency 12mo
            planId = "64ad0d250e40385f299bceea"
          }  else if (priceId === "price_1NSZjsFe80Kn2YGGYa3pzseT") { //Standard mo
            planId = "64ad0d740e40385f299bcef9"
          }  else if (priceId === "price_1NSafTFe80Kn2YGG5LVrITu1") { //Standard 3mo
            planId = "64ad0d740e40385f299bcef9"
          }  else if (priceId === "price_1NSagKFe80Kn2YGGFhOuum7Z") { //Standard 6mo
            planId = "64ad0d740e40385f299bcef9"
          }  else if (priceId === "price_1NSaglFe80Kn2YGGZZ8msY1r") { //Standard 12mo
            planId = "64ad0d740e40385f299bcef9"
          } 

          const plan = await Plan.findById(planId);

          user.tokenBalance += plan.monthlyTokens;
  
          // Create a new transaction
          transaction = new Transaction({
              value: plan.monthlyTokens,
              title: `+${plan.monthlyTokens} tokens`,
              type: 'income',
              timestamp: Date.now()
          });
          user.transactions.push(transaction);


          if(user.accountType === "company"){
             //generate infakt invoice for first subscription payment
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
          
            let infaktClientsResponse = await axios.get(`https://api.infakt.pl/v3/clients.json?q[email_eq]=${user.contactEmail}`, infaktConfig);
            let infaktClients = infaktClientsResponse.data;
            if (infaktClients.length > 0) {
              infaktClientId = infaktClients[0].id;
            }
            invoiceData = { //for companies
              invoice: {
                "client_company_name": user.companyName, 
                "invoice_date": `${year}-${month}-${day}`,
                "sale_date": `${year}-${month}-${day}`,
                "status": "paid",
                "paid_date": `${year}-${month}-${day}`,
                "payment_method": "card",
                "client_id": infaktClientId,
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
          if (user.accountType === "company"){
            await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
            await new Promise(resolve => setTimeout(resolve, 2500));
            const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
            const lastInvoiceID = latestInvoice.data.entities[0].id;
            await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/paid.json`, {invoice: {"status": "paid"}}, infaktConfig);
            await axios.post(`https://api.infakt.pl/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
          }
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


router.post('/cancel-subscription', requireAuth, async (req, res) => {
  const user = req.user;
  try {
    await User.updateOne({ _id: user._id }, { plan: null });
    const customer = await stripe.customers.list({ email: user.email });
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.data[0].id,
    });
    const currentSubscriptionID = subscriptions.data[0].id;
    const deleted = await stripe.subscriptions.del(
      currentSubscriptionID
    );

    res.status(200).json({ message: "Subscription cancelled", deletedSubscription: deleted });
  } catch (e) {
  res.status(500).json({message: "Error cancelling subscripiton", error: e})
  }
});


router.post('/update-subscription', requireAuth, async (req, res) => {
  const user = req.user;
  const { priceId, planId } = req.body;

  try {
    const customer = await stripe.customers.list({ email: user.email });
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


    if(user.accountType === "company"){
      let invoiceData;
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      let infaktClientId;
      //check if client is in infakt if not then create new one
      let infaktClientsResponse = await axios.get(`https://api.infakt.pl/v3/clients.json?q[email_eq]=${user.contactEmail}`, infaktConfig);
      let infaktClients = infaktClientsResponse.data;
      if (infaktClients.length > 0) {
        infaktClientId = infaktClients[0].id;
      }
      invoiceData = { //for companies
        invoice: {
          "client_company_name": user.companyName, 
          "invoice_date": `${year}-${month}-${day}`,
          "sale_date": `${year}-${month}-${day}`,
          "payment_method": "card",
          "status": "paid",
          "paid_date": `${year}-${month}-${day}`,
          "client_id": infaktClientId,
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
    }

    const balanceSnapshot = {
      timestamp: Date.now(),
      balance: user.tokenBalance
    };
    user.tokenHistory.push(balanceSnapshot);

    try {
      if(user.accountType === "company"){
        await axios.post('https://api.infakt.pl/v3/invoices.json', invoiceData, infaktConfig);
        await new Promise(resolve => setTimeout(resolve, 2500));
        const latestInvoice = await axios.get('https://api.infakt.pl/v3/invoices.json?limit=1', infaktConfig);
        const lastInvoiceID = latestInvoice.data.entities[0].uuid;
        // await axios.post(`https://api.infakt.pl/api/v3/invoices/${lastInvoiceID}/paid.json`, {}, infaktConfig);
        await axios.post(`https://api.infakt.pl/api/v3/invoices/${lastInvoiceID}/deliver_via_email.json`, {"print_type": "original"}, infaktConfig);
      }
      await user.save();
      await transaction.save();
      await purchase.save();
    } catch (error) {
      console.error(`Error: ${JSON.stringify(error.response.data)}`);
    }

    res.status(200).json({ message: "Subscription updated", subscription });
} catch (e) {
  res.status(500).json({message: "Error updating subscripiton", error: e})
}
});


module.exports = router;   