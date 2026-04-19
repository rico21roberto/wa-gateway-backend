module.exports = function(req,res,next){
  const key = req.headers['x-api-key'];
  if(key !== "IMIGRASI_KEY"){
    return res.status(403).json({msg:'Invalid API Key'});
  }
  next();
}
