const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Paspor = require("./models/Paspor");
const Ticket = require("./models/Ticket");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { startWhatsApp, sendMessage, getQR, getStatus } = require("./whatsapp");
const Admin = require("./models/Admin");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "upload/" });

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

/* ================== DATABASE ================== */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Atlas Connected ✅"))
.catch(err => console.log(err));

mongoose.connection.once("open", async () => {
  const existing = await Admin.findOne({ username: "admin" });

  if (!existing) {
    await Admin.create({
      username: "admin",
      password: "12345",
    });

    console.log("Admin default dibuat ✅");
  }
});

/* ================== WHATSAPP ================== */
startWhatsApp();

app.get("/qr", (req, res) => {
  res.json({
    qr: getQR(),
    status: getStatus(),
  });
});

/* ================== AUTH ================== */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username, password });

  if (!admin) {
    return res.status(401).json({ message: "Login gagal ❌" });
  }

  res.json({
    message: "Login berhasil ✅",
    user: admin,
  });
});

/* ================== PASPOR ================== */
app.get("/paspor", async (req, res) => {
  const search = req.query.search;
  let query = {};

  if (search) {
    query.no_permohonan = { $regex: search, $options: "i" };
  }

  const data = await Paspor.find(query).limit(100);
  res.json(data);
});

/* ================== UPLOAD EXCEL ================== */
app.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    await Paspor.deleteMany({});
    await Paspor.insertMany(data, { ordered: false });

    res.json({ message: "Upload berhasil ✅" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Gagal upload" });
  }
});

/* ================== KIRIM WA ================== */
app.post("/api/ticket", async (req, res) => {
  const { phone, message } = req.body;

  await sendMessage(phone, "Ticket diterima: " + message);

  res.json({ success: true });
});

/* ================== GRAFIK ================== */

/* 🔥 GRAFIK PENGADUAN PER HARI */
app.get("/grafik-pengaduan", async (req, res) => {
  try {
    const data = await Ticket.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* 🔥 GRAFIK PASPOR (TOTAL DATA) */
app.get("/grafik-paspor", async (req, res) => {
  try {
    const total = await Paspor.countDocuments();

    res.json([
      {
        name: "Paspor",
        total: total,
      },
    ]);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* ================== ROOT ================== */
app.get("/", (req, res) => {
  res.send("WA Gateway Running ✅");
});

/* ================== START SERVER ================== */
//app.listen(3000, () => {
//  console.log("Server running on port 3000 🚀");
//});
    const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => 
          console.log("Server running on port", PORT));