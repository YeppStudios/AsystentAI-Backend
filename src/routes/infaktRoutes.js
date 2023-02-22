const express = require('express');
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const axios = require('axios');
require('dotenv').config();
const router = express.Router();


router.post('/generateInvoice', (req, res) => {
    const { async_invoice } = req.body;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const name = "Marcin Kliszczak";
    const lastName = name.split(" ")[1];
    const firstname = name.split(" ")[0];
    const config = {
      headers: {
        'X-inFakt-ApiKey': `${process.env.INFAKT_KEY}`,
        'Content-Type': 'application/json',
      },
    };
  
    const data = {
      async_invoice: {
        // "client_company_name": "Company", 
        "invoice_date": `${year}-${month}-${day}`,
        "sale_date": `${year}-${month}-${day}`,
        "status": "paid",
        "client_first_name": firstname,
        "client_last_name": lastName,
        "client_street": "ul. Pawiana",
        "client_street_number": "44",
        "client_city": "Kraków",
        "client_post_code": "34-040",
        // "client_tax_code": "7812043227",
        "client_country": "Polska",
        "paid_price": 4999, 
        "services":[
          {
             "name": "Przykładowa Usługa", 
             "pkwiu": "62.01", 
             "tax_symbol": 23,
             "gross_price": 4999, 
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