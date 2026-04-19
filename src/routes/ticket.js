const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middleware/jwt');

let tickets = [];

router.post('/', jwtMiddleware, (req,res)=>{
  const {message, phone} = req.body;
  const ticket = {
    id: Date.now(),
    ticket_id: "IMB-"+Date.now(),
    phone,
    message,
    status:"OPEN"
  };
  tickets.push(ticket);
  res.json(ticket);
});

router.get('/', jwtMiddleware, (req,res)=>{
  res.json(tickets);
});

module.exports = router;
