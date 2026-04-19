const jwt = require('jsonwebtoken');

module.exports = function(req,res,next){
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({msg:'Unauthorized'});

  try{
    const decoded = jwt.verify(token, "SECRET_KEY");
    req.user = decoded;
    next();
  }catch(err){
    res.status(403).json({msg:'Invalid token'});
  }
}
