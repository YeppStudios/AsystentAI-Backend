const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reservation = mongoose.model('Reservation');
const BusinessReservation = mongoose.model('BusinessReservation');

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

  router.get('/sumSpots', async (req, res) => {
    try {
      const reservations = await Reservation.find();
      let totalSpots = 0;
      reservations.forEach(reservation => {
        totalSpots += parseInt(reservation.spots);
      });
      res.send({ totalSpots });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  });

  router.post('/add-business-reservation', async (req, res) => {
    try {
      const reservation = new BusinessReservation({
        company: req.body.company,
        email: req.body.email,
        website: req.body.website
      });
      await reservation.save();
      res.status(201).json({ message: 'Reservation added successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Route for getting all reservations
  router.get('/business-reservations', async (req, res) => {
    try {
      const reservations = await BusinessReservation.find();
      res.status(200).json(reservations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
module.exports = router;
