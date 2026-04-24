const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Paspor = require("./models/Paspor");
const Ticket = require("./models/Ticket");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { sendMessage, getQR, getStatus } = require("./whatsapp");
const Admin = require("./models/Admin");
const fs = require("fs");
require("dotenv").config();

const app = express();

/* ================== FIX UPLOAD FOLDER ================== */
if (!fs.existsSync("upload")) {
  fs.mkdirSync("upload");
}
const upload = multer({ dest: "upload/" });

/* ================== MIDDLEWARE ================== */
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(cookieParser());

/* ================== GLOBAL ERROR ================== */
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED PROMISE:", err);
});

/* ================== DATABASE ================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas Connected ✅"))
  .catch(err => console.log(err));

mongoose.connection.once("open", async () => {
  console.log("MongoDB connected");

  let existing = await Admin.findOne({ username: "admin" });

  if (!existing) {
    await Admin.create({
      username: "admin",
      password: "12345",
    });
    console.log("Admin default dibuat ✅");
  } else {
    console.log("Admin sudah ada ✅");
  }
});

/* ================== ROOT ================== */
app.get("/", (req, res) => {
  res.send("API Running ✅");
});

/* ================== QR WA ================== */
app.get("/qr", (req, res) => {
  res.json({
    qr: getQR(),
    status: getStatus(),
  });
});

/* ================== LOGIN ================== */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username, password });

    if (!admin) {
      return res.status(401).json({ message: "Login gagal ❌" });
    }

    res.json({
      message: "Login berhasil ✅",
      user: admin,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ================== PASPOR ================== */
app.get("/paspor", async (req, res) => {
  try {
    const search = req.query.search;
    let query = {};

    if (search) {
      query.no_permohonan = { $regex: search, $options: "i" };
    }

    const data = await Paspor.find(query).limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* ================== UPLOAD EXCEL ================== */
app.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File tidak ada" });
    }

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
  try {
    const { phone, message } = req.body;

    if (sendMessage) {
      await sendMessage(phone, "Ticket diterima: " + message);
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "WA error" });
  }
});

/* ================== GRAFIK ================== */
app.get("/grafik-pengaduan", async (req, res) => {
  try {
    const data = await Ticket.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
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

/* ================== START SERVER ================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});