const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reservation = mongoose.model('Reservation');


router.post('/addReservation', async (req, res) => {
    try {
      const { fullName, spots, companyName, email, phone } = req.body;
  
      // Check if there is already a reservation with this email
      const existingReservation = await Reservation.findOne({ email });
      if (existingReservation) {
        return res.status(400).json({ error: 'There is already a reservation with this email address' });
      }
  
      const reservation = new Reservation({ fullName, spots, companyName, email, phone });
      await reservation.save();
      res.status(201).json(reservation);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  router.get('/reservations', async (req, res) => {
    try {
      const reservations = await Reservation.find();
      res.json(reservations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
module.exports = router;
