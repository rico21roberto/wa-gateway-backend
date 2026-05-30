const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const Ticket = require("./models/Ticket");
const Paspor = require("./models/Paspor");
const QRCode = require("qrcode");
const fs = require("fs");

let isConnected = false;
let userState = {};
let sock;
let latestQR = null;
let lastMessageTime = {};

// ================= DELAY =================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ================= START =================
async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      browser: ["Ubuntu", "Chrome", "120.0"], 
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);

    // ================= CONNECTION =================
    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      // 🔥 QR MASUK
      if (qr) {
        console.log("QR updated");

        try {
          latestQR = await QRCode.toDataURL(qr);
          isConnected = false;
        } catch (err) {
          console.log("QR ERROR:", err);
        }
      }

      // 🔥 CONNECTED
      if (connection === "open") {
        console.log("WhatsApp Connected ✅");
        isConnected = true;

        setTimeout(() => {
          latestQR = null;
        }, 3000);
      }

      // 🔥 DISCONNECT
      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;

        console.log("Disconnected:", reason);

        isConnected = false;
        latestQR = null;
        userState = {};
        lastMessageTime = {};

        // ❗ SESSION EXPIRED
        if (reason === 401) {
          console.log("Session expired → reset auth");

          try {
            fs.rmSync("auth", { recursive: true, force: true });
          } catch (err) {
            console.log("Gagal hapus auth:", err);
          }

          return startWhatsApp();
        }

        // 🔥 RECONNECT DELAY (PENTING)
        if (reason !== DisconnectReason.loggedOut) {
          console.log("Reconnect 5 detik...");
          setTimeout(() => {
            startWhatsApp();
          }, 5000);
        } else {
          console.log("Logged out, scan ulang manual");
        }
      }
    });

    // ================= LISTENER =================
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];

        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;

        if (sender.includes("status@broadcast")) return;

        let text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text;

        if (!text) return;

        text = text.toLowerCase().trim();

        if (text.length > 100) return;

        console.log("Pesan masuk:", text);

        await handleMessage(sender, text);
      } catch (err) {
        console.log("ERROR MESSAGE:", err);
      }
    });

  } catch (err) {
    console.log("START ERROR:", err);
  }
}

// ================= HANDLE =================
async function handleMessage(sender, text) {
  try {

    await delay(3000 + Math.random() * 3000);

    const now = Date.now();

    if (lastMessageTime[sender] && now - lastMessageTime[sender] < 5000) {
      return;
    }

    lastMessageTime[sender] = now;

    if (!userState[sender] && text !== "1" && text !== "2" && text !== "3") {
      userState[sender] = "menu";

      await delay(2000 + Math.random() * 3000);
      return sock.sendMessage(sender, {
        text: `Selamat datang di Imigrasi Belawan 👋

1. Persyaratan dan Prosedur Pembuatan Paspor
2. Pengaduan
3. Cek Status Paspor`
      });
    }

    if (text === "1") {
      
      delete userState[sender];
      
      await delay(2000 + Math.random() * 3000);
      
      return sock.sendMessage(sender, {
        text: `📄 *INFO PERSYARATAN & PROSEDUR PASPOR*

            🔹 *Paspor Baru*
            Syarat:
            1. KTP asli
            2. KK asli
            3. Akta lahir / Ijazah / Buku Nikah / Surat Baptis

            🔹 *Perpanjang Paspor*
            Syarat:
            - Wajib melampirkan paspor lama

            💰 *Biaya Pembuatan / Perpanjangan*
            1. Non Elektronik 5 tahun : Rp 350.000
            2. Non Elektronik 10 tahun : Rp 650.000
            3. Elektronik 5 tahun : Rp 650.000
            4. Elektronik 10 tahun : Rp 950.000

            ⏱️ Proses: 4 hari kerja setelah pembayaran

            🔹 *Paspor Hilang / Rusak*
            Syarat:
            1. Surat kehilangan dari kepolisian

            💰 Biaya:
            - Hilang : Rp 1.000.000
            - Rusak : Rp 500.000

            ⏱️ Proses: 4 hari kerja setelah pembayaran

            📲 Download aplikasi M-Paspor:
            https://play.google.com/store/apps/details?id=id.go.imigrasi.paspor_online
`
      });
    }

    if (text === "2") {
      userState[sender] = "pengaduan";

      await delay(2000 + Math.random() * 3000);
      return sock.sendMessage(sender, {
        text: "Silakan kirim pengaduan Anda."
      });
    }

    if (text === "3") {
      userState[sender] = "cek_status_paspor";

      await delay(3000 + Math.random() * 3000);
      return sock.sendMessage(sender, {
        text: "Masukkan Nomor Permohonan Anda"
      });
    }

    // PENGADUAN
    if (userState[sender] === "pengaduan") {
      const ticket = await Ticket.create({
        phone: sender,
        message: text,
      });

      delete userState[sender];

      await delay(2000 + Math.random() * 3000);
      return sock.sendMessage(sender, {
        text: `Pengaduan diterima ✅
No Tiket: ${ticket._id}`
      });
    }

    // CEK PASPOR
    if (userState[sender] === "cek_status_paspor") {
      const result = await Paspor.findOne({
        no_permohonan: text,
      });

      delete userState[sender];

      await delay(2000 + Math.random() * 3000);

      if (!result) {
        return sock.sendMessage(sender, {
          text: "Paspor anda masih dalam tahap proses"
        });
      }

      return sock.sendMessage(sender, {
        text: `Status Permohonan
Nomor Permohonan: ${result.no_permohonan}
Nomor Paspor: ${result.no_paspor}
Nama: ${result.nama}
Status: Paspor Anda sudah selesai, silahkan diambil ke kantor imigrasi belawan.`
      });
    }

    
  } catch (err) {
    console.log("ERROR HANDLE:", err);
  }
}

// ================= SEND =================
async function sendMessage(phone, message) {
  if (!sock || !isConnected) return;

  const jid = phone + "@s.whatsapp.net";
  
  await delay(5000 + Math.random() * 5000);
  
  return sock.sendMessage(jid, { text: message });
}

// ================= API =================
function getQR() {
  return latestQR;
}

function getStatus() {
  return isConnected;
}

module.exports = {
  startWhatsApp,
  sendMessage,
  getQR,
  getStatus,
};