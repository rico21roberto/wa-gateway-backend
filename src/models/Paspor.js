const mongoose = require("mongoose");

const pasporSchema = new mongoose.Schema({}, {strict: false});

module.exports = mongoose.model("Paspor", pasporSchema);