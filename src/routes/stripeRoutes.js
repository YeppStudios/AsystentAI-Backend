const express = require('express');
require('dotenv').config()
const bodyParser = require('body-parser');
const requireAuth = require('../middlewares/requireAuth');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Plan = mongoose.model('Plan');
const Payment = mongoose.model('Payment');
const Transaction = mongoose.model('Transaction');
const Workspace = mongoose.model('Workspace');
const Document = mongoose.model('Document');
const Folder = mongoose.model('Folder');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_KEY);
const mailchimp = require('@mailchimp/mailchimp_marketing');
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const purchaseEndpointSecret = 'whsec_VIcwCMNdNcXotMOrZCrIwrbptD0Vffdj';
const subscriptionEndpointSecret = 'whsec_NInmuuTZVfBMnfTzNFZJTl0I67u62GCz';
const customerCreationSectret = 'whsec_287PqXJ4mj2RXDjKenIv1ORJpghta50d';
const failedPaymentSecret = "whsec_xQz0mVtW4SNJZU7hkM8gjpSnGo7b4r4J";
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
          allow_promotion_codes: true,
          subscription_data: {
            trial_period_days: 7
          },
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
          customer_email: email,
          automatic_tax: {
            enabled: true,
          },
          tax_id_collection: {
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
          infaktInvoice: false,
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
    try {
      User.findOne({ email: email }, async (err, user) => {
        if(user) {
          let transaction;
          let purchase;
          user.dashboardAccess = true;
          if (user.referredBy) {
            try {
              const referringUser = await User.findById(user.referredBy);
              if (referringUser) {
                referringUser.registeredByReferral += 1;
                referringUser.referrals.push({type: "registered", timestamp: Date.now(), email: email});
                await referringUser.save()
              }
            } catch (e) {
            }
          }

          //add tokens if trial
          if (!transactionData.metadata.trial) {
            if (transactionData.metadata.plan_id) { //handle initial subscription purchase
              try {
                const planId = transactionData.metadata.plan_id;
                const plan = await Plan.findById(planId);
                user.plan = plan;
                user.tokenBalance += plan.monthlyTokens*Number(transactionData.metadata.months);
  
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
        }
      });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  }

  response.status(200).send('Webhook received');
});


//listening for subscription payments
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
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

        let transaction;
        let planId;
        let priceId = event.data.object.lines.data[0].plan.id;
        if (user.createdAt > tenDaysAgo) { //if user is new, send welcome email
          try {
            const msg = {
              to: `${user.email}`,
              nickname: "Wiktor from Yepp AI",
              from: {
                email: "hello@yepp.ai",
                name: "Wiktor from Yepp AI"
              },
              templateId: 'd-6100357c35f642d39329f644f3d97caa',
              dynamicTemplateData: {
              name: `${user.name}`,
              },
            };
            sgMail
              .send(msg)
          } catch (e) {
            console.log(e)
          }
        }
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
          } else if (priceId === "price_1NUPofFe80Kn2YGG6dYxHNk9") {//agency monthly full price
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSai5Fe80Kn2YGGHrwmUEqe") { //Agency 3mo
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSaiNFe80Kn2YGGG88egvhI") { //Agency 6mo
            planId = "64ad0d250e40385f299bceea"
          } else if (priceId === "price_1NSaieFe80Kn2YGGilwS3SNl") { //Agency 12mo
            planId = "64ad0d250e40385f299bceea"
          }  else if (priceId === "price_1NSZjsFe80Kn2YGGYa3pzseT") { //Standard mo
            planId = "64ad0d740e40385f299bcef9"
          } else if (priceId === "price_1NaF8EFe80Kn2YGGAuVBGHjh") { //Standard mo
            planId = "64ad0d740e40385f299bcef9"
          } else if (priceId === "price_1NaFKUFYGGN8gOfDnT") { //Standard 3mo
            planId = "64ad0d740e40385f299be80Kn2cef9"
          }  else if (priceId === "price_1NaFLfFe80Kn2YGGFtgjV1CI") { //Standard 6mo
            planId = "64ad0d740e40385f299bcef9"
          }  else if (priceId === "price_1NaFMhFe80Kn2YGGsXAeqFPF") { //Standard 12mo
            planId = "64ad0d740e40385f299bcef9"
          } else if (priceId === "price_1NVVfpFe80Kn2YGGDCHIg1aX") { ///Assistant Business Monthly discount
            planId = "6444d4394ab2cf9819e5b5f4";
          }

          const plan = await Plan.findById(planId);

          user.tokenBalance += plan.monthlyTokens;
          user.plan = planId;

          try {
          // add to referrer
          if (user.referredBy) {
            try {
              const referringUser = await User.findById(user.referredBy);
              if (referringUser) {
                if (priceId === "price_1NaF8EFe80Kn2YGGAuVBGHjh" || priceId === "price_1NaFLfFe80Kn2YGGFtgjV1CI" || priceId === "price_1NaFLfFe80Kn2YGGFtgjV1CI" || priceId === "price_1NaFMhFe80Kn2YGGsXAeqFPF") {
                  referringUser.referrals.push({type: "purchased standard", timestamp: Date.now(), email: user.email});
                } else if (priceId === "price_1NSZghFe80Kn2YGGOiClJUPM" || priceId === "price_1NUPofFe80Kn2YGG6dYxHNk9" || priceId === "price_1NSai5Fe80Kn2YGGHrwmUEqe" || priceId === "price_1NSaiNFe80Kn2YGGG88egvhI" || priceId === "price_1NSaieFe80Kn2YGGilwS3SNl") {
                  referringUser.referrals.push({type: "purchased agency", timestamp: Date.now(), email: user.email});
                }
                await referringUser.save();
              }
            } catch (e) {
            }
          }
          } catch (e) {
          }
  
          // Create a new transaction
          transaction = new Transaction({
              value: plan.monthlyTokens,
              title: `+${plan.monthlyTokens} tokens`,
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

        await user.save();
        await transaction.save();
      }
    });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  } 

  response.status(200).send('Webhook received');
});


//listening for failed payments
router.post('/failed-payment-webhook', bodyParser.raw({type: 'application/json'}), async (request, response) => {
  const payload = request.rawBody;
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, failedPaymentSecret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'invoice.payment_failed' ) {
    try {
    const userEmail = event.data.object.customer_email;
    User.findOne({ email: userEmail }, async (err, user) => {
      if(user) {
        user.dashboardAccess = false;
        try {
          const msg = {
            to: `${user.email}`,
            nickname: "Wiktor from Yepp",
            from: {
              email: "hello@yepp.ai",
              name: "Wiktor from Yepp"
            },
            templateId: ' d-555679e4d7c248d6ac8bf1da521a17c8',
            dynamicTemplateData: {
            name: `${user.name}`,
            },
          };
          sgMail
            .send(msg)
        } catch (e) {
          console.log(e)
        }

        await user.save();
      }
    });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  } 
  response.status(200).send('Webhook received');
});



router.post('/customer-created', bodyParser.raw({type: 'application/json'}), async (request, response) => {
  const payload = request.rawBody;
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, customerCreationSectret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.created') {
    const customer = event.data.object;
    try {
      User.findOne({ email: customer.email }, async (err, user) => {
        const msg = {
          to: `${user.email}`,
          nickname: "Wiktor from Yepp",
          from: {
            email: "hello@yepp.ai",
            name: "Wiktor from Yepp"
          },
          templateId: 'd-e7d32dea78d7448db0e7b9dfb2c5805c',
          dynamicTemplateData: {
          name: user.name,
          },
        };
        sgMail
          .send(msg)
          .then(() => {
              response.status(200).json({ status: 'Email sent' });
          })
          .catch((error) => {
              response.status(500).json({ error: 'Failed to send email' });
          });
      });
    } catch (e) {
      return response.status(400).send(`Webhook Error: ${e.message}`);
    }
  }
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
    const deleted = await stripe.subscriptions.cancel(
      currentSubscriptionID
    );
      const msg = {
        to: `${user.email}`,
        nickname: "Wiktor from Yepp",
        from: {
          email: "hello@yepp.ai",
          name: "Wiktor from Yepp"
        },
        templateId: 'd-4e1e8c4e73384788b926d331b3e39bd3',
        dynamicTemplateData: {
        name: `${user.name.split(' ')[0]}`,
        },
      };
      sgMail.send(msg);
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


router.post('/create-customer-portal-session', requireAuth, async (req, res) => {
  try {
    let customer = null;
    const customerList = await stripe.customers.list({ email: req.body.email, limit: 1 });
    if (customerList.data.length > 0) {
      customer = customerList.data[0];
    } else {
      customer = await stripe.customers.create({
        email: email
      });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: `${customer.id}`,
      return_url: 'https://yepp.ai/profile',
    });
  
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({message: "Error displaying subscription portal", error: e})
  }

});


router.post('/updateMailchimpTags', async (req, res) => {
  try {
      // 1. Fetch active subscriptions from Stripe
      let activeSubscriptions = await stripe.subscriptions.list({
          status: 'active',
          limit: 100 // Adjust limit as needed
      });
      
      // Extract customer IDs from active subscriptions
      let customerIds = activeSubscriptions.data.map(subscription => subscription.customer);

      // Fetch customer details for each active subscription
      let customerDetailsPromises = customerIds.map(customerId => stripe.customers.retrieve(customerId));
      let paidCustomers = await Promise.all(customerDetailsPromises);
      
      // Extract email addresses
      let paidEmails = paidCustomers.map(customer => customer.email);

      // 2. Extract domains
      let domains = [...new Set(paidEmails.map(email => email.split('@')[1]))];

      // Exclude specific domains
      const excludedDomains = ["gmail.com", "onet.eu", "op.pl"];
      domains = domains.filter(domain => !excludedDomains.includes(domain));

      // 3. & 4. Search for these domains in Mailchimp and tag them
      for (const domain of domains) {
          let members = await getMailchimpMembersWithDomain(domain);
          console.log(members)
          for (const member of members) {
              await tagMailchimpMember(member.id);
          }
      }

      return res.send({ success: true, domains });

  } catch (error) {
      console.error("Error updating tags:", error);
      res.status(500).send({ success: false, message: "Internal server error." });
  }
});

// Function to search Mailchimp members with the provided domain
async function getMailchimpMembersWithDomain(domain) {
  const response = await mailchimp.searchMembers.search(`@${domain}`);
  console.log(response.full_search.members.filter(member => member.email_address.endsWith(`@${domain}`)));
  return response.full_search.members.filter(member => member.email_address.endsWith(`@${domain}`)) || [];
}

// Function to tag a Mailchimp member
async function tagMailchimpMember(memberId) {
  await mailchimp.lists.updateListMemberTags(
    process.env.MAILCHIMP_AUDIENCE_ID,
    memberId,
    { tags: [{ name: "PAID", status: "active" }] }
  );
  return;
}

module.exports = router;   