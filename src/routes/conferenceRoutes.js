const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reservation = mongoose.model('Reservation');

// POST /reservations
router.post('/addReservation', async (req, res) => {
  try {
    const { fullName, spots, companyName, email, phone } = req.body;
    const reservation = new Reservation({ fullName, spots, companyName, email, phone });
    await reservation.save();
    res.status(201).json(reservation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
