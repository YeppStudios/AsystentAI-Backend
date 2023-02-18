const express = require('express');
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const axios = require('axios');

const router = express.Router();


router.post('/generateInvoice', (req, res) => {
    const { async_invoice } = req.body;
  
    const config = {
      headers: {
        'X-inFakt-ApiKey': '9fbb8dbfa7c2cc5bbbfd115b49ed3f5e672c20f2',
        'Content-Type': 'application/json',
      },
    };
  
    const data = {
      async_invoice: {
        "payment_method": "cash", 
        "client_company_name": "company", 
        "services":[
          {
             "name": "Przykładowa Usługa", 
             "net_price": 6623, 
             "pkwiu": "84.11.12.0", 
             "unit_net_price": 6623, 
             "tax_symbol": 23 
          }
        ]
      },
    };
  
    axios
      .post('https://api.infakt.pl/v3/async/invoices/send.json', data, config)
      .then((response) => {
        res.status(200).json(response.data);
      })
      .catch((error) => {
        res.status(400).json(error);
      });
  });

  module.exports = router;