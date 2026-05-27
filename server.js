const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ✅ JSONBin.io config
const JSONBIN_API_KEY = "$2a$10$5LHVrYIp.Dt86ypyQ4oetuNQ5vOqiFcQRomq1r2RZg6RlnzWwKFZi";
const BIN_ID = "6a10624f6877513b27b590b7";

// ✅ Message protection settings
let loadedSuccessfully = false;  // Prevents overwriting JSONBin if load failed
let saveTimer = null;            // Debounce timer for saves
const MESSAGE_LIMIT = 100;      // Keep last 100 messages (was 15)

async function loadMessages() {
  // Retry up to 3 times with 2-second delay between attempts
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`📦 Loading messages from JSONBin (attempt ${attempt}/3)...`);
      const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { "X-Master-Key": JSONBIN_API_KEY }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const msgs = data.record || [];
      loadedSuccessfully = true;  // ✅ Load succeeded — saves are allowed
      console.log("✅ Messages loaded from JSONBin");
      return msgs;
    } catch (err) {
      console.error(`📦 Load attempt ${attempt} failed:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
      }
    }
  }

  console.error("📦 ❌ All 3 load attempts failed. SAVES DISABLED to protect existing data.");
  loadedSuccessfully = false;
  return [];
}

// Debounced save — waits 2 seconds after last message before saving
// Prevents hitting JSONBin rate limits when messages come in rapidly
function scheduleSave() {
  if (!loadedSuccessfully) {
    console.warn("📦 ⚠️ Save skipped — initial load failed. Existing data protected.");
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveMessages();
  }, 2000);
}

async function saveMessages() {
  if (!loadedSuccessfully) {
    console.warn("📦 ⚠️ Save blocked — initial load failed.");
    return;
  }
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY
      },
      body: JSON.stringify(messageHistory)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(`✅ Saved ${messageHistory.length} messages to JSONBin`);
  } catch (err) {
    console.error("Failed to save messages:", err.message);
  }
}

// ✅ Gmail setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "poonamgole19@gmail.com",
    pass: "mtcf ifkf aiqb mzgo"
  }
});

const USER_EMAILS = {
  "Tumaji": "tumaji_email@gmail.com",
  "Rani": "poonamgole19@gmail.com"
};

function sendOnlineNotification(username) {
  console.log("📧 Trying to send notification for:", username); 
  const otherUser = Object.keys(USER_EMAILS).find(u => u !== username);
  if (!otherUser) {
    console.log("❌ No other user found");
    return;
  }

  const toEmail = USER_EMAILS[otherUser];

  const mailOptions = {
    from: "poonamgole19@gmail.com",
    to: toEmail,
    subject: "Amazon Sale is on",
    text: `Logged in and Grab the offer.\n\nTime: ${new Date().toLocaleString()}`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("Email failed:", err.message);
    } else {
      console.log("✅ Notification sent to", toEmail);
    }
  });
}

let users = {};
let messageHistory = [];

// ✅ Load messages on startup
loadMessages().then(msgs => {
  messageHistory = msgs;
  console.log("✅ Loaded", messageHistory.length, "messages. Saves:", loadedSuccessfully ? "ENABLED" : "BLOCKED");
});

io.on("connection", (socket) => {

  // ======================
  // USER JOIN
  // ======================
  socket.on("user joined", (username) => {
    console.log("🔵 USER JOINED:", username); 
    socket.username = username;
    users[username] = socket.id;

    socket.emit("chat history", messageHistory);

    io.emit("online users", Object.keys(users));
    console.log("🔵 About to send notification");
    sendOnlineNotification(username);
    console.log("🔵 Notification function called");
  });

  socket.on("disconnect", () => {
    delete users[socket.username];
    io.emit("online users", Object.keys(users));
  });

  // ======================
  // CHAT
  // ======================
  socket.on("chat message", (msg) => {
    if (!msg.text || !msg.text.trim()) return;

    msg.id = Date.now();
    msg.time = new Date();
    msg.delivered = true;

    messageHistory.push(msg);
    if (messageHistory.length > MESSAGE_LIMIT) {
      messageHistory = messageHistory.slice(-MESSAGE_LIMIT);
    }

    scheduleSave();  // ✅ Debounced save (prevents rate limiting)

    io.emit("chat message", msg);
  });

  // ======================
  // CLEAR HISTORY
  // ======================
  socket.on("clear history", () => {
    messageHistory = [];
    loadedSuccessfully = true; // Intentional clear — allow the save
    saveMessages();
    io.emit("history cleared");
    console.log("🗑️ Chat history cleared by", socket.username);
  });

  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // ======================
  // CALL FLOW
  // ======================
  socket.on("call-user", ({ to, offer, type }) => {
    io.to(users[to]).emit("incoming-call", {
      from: socket.username,
      offer,
      type
    });
  });

  socket.on("call-accepted", ({ to, answer }) => {
    io.to(users[to]).emit("call-answered", answer);
  });

  socket.on("call-rejected", ({ to }) => {
    io.to(users[to]).emit("call-rejected");
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(users[to]).emit("ice-candidate", candidate);
  });

  socket.on("call-ended", ({ to }) => {
    io.to(users[to]).emit("call-ended");
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
