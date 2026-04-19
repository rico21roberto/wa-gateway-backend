const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req,res)=>{
  const {username} = req.body;
  const token = jwt.sign({username}, "SECRET_KEY",{expiresIn:'8h'});
  res.json({token});
});

module.exports = router;
