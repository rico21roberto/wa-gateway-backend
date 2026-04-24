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
      browser: ["Ubuntu", "Chrome", "120.0"], // 🔥 FIX RAILWAY
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
    const now = Date.now();

    if (lastMessageTime[sender] && now - lastMessageTime[sender] < 5000) {
      return;
    }

    lastMessageTime[sender] = now;

    if (text === "halo" || text === "menu") {
      userState[sender] = "menu";

      await delay(1500);
      return sock.sendMessage(sender, {
        text: `Selamat datang di Imigrasi Belawan 👋

1. Info Paspor
2. Pengaduan
3. Cek Status Paspor`
      });
    }

    if (text === "1") {
      await delay(1500);
      return sock.sendMessage(sender, {
        text: "Syarat Paspor:\n- KTP\n- KK\n- Akta Lahir"
      });
    }

    if (text === "2") {
      userState[sender] = "pengaduan";

      await delay(1500);
      return sock.sendMessage(sender, {
        text: "Silakan kirim pengaduan Anda."
      });
    }

    if (text === "3") {
      userState[sender] = "cek_status_paspor";

      await delay(1500);
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

      userState[sender] = null;

      await delay(1500);
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

      userState[sender] = null;

      await delay(1500);

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

    await delay(1500);
    return sock.sendMessage(sender, {
      text: "Ketik *menu* ya 😊"
    });

  } catch (err) {
    console.log("ERROR HANDLE:", err);
  }
}

// ================= SEND =================
function sendMessage(phone, message) {
  if (!sock) return;

  const jid = phone + "@s.whatsapp.net";
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