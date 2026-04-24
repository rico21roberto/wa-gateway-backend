const XLSX = require("xlsx");

function readData() {
  const file = XLSX.readFile("data/paspor.xlsx");
  const sheet = file.Sheets[file.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

module.exports = readData;