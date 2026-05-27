const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));
// ==========================================
// CONFIGURATION (JSONBin & Nodemailer)
// ==========================================
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || "$2a$10$5LHVrYIp.Dt86ypyQ4oetuNQ5vOqiFcQRomq1r2RZg6RlnzWwKFZi";
const BIN_ID = process.env.BIN_ID || "6a10624f6877513b27b590b7";
// ✅ JSONBin.io config
const JSONBIN_API_KEY = "$2a$10$5LHVrYIp.Dt86ypyQ4oetuNQ5vOqiFcQRomq1r2RZg6RlnzWwKFZi";
const BIN_ID = "6a10624f6877513b27b590b7";
// Gmail credentials for sending notifications
const GMAIL_USER = process.env.GMAIL_USER || "poonamgole19@gmail.com";
const GMAIL_PASS = process.env.GMAIL_PASS || ""; // Put Gmail App Password here or set via Env Var
// User Email Directory
const USER_EMAILS = {
  "Tumaji": process.env.TUMAJI_EMAIL || "tumaji_email@gmail.com",
  "Rani": process.env.RANI_EMAIL || "poonamgole19@gmail.com"
};
// ==========================================
// NODEMAILER TRANSPORTER SETUP
// ==========================================
let transporter = null;
if (GMAIL_USER && GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS
    }
  });
}
function sendOnlineNotification(username) {
  if (!transporter) {
    console.log("ℹ️ Email notifications are disabled (GMAIL_USER or GMAIL_PASS is not set).");
    return;
  }
  // Find the other user's email
  const otherUser = Object.keys(USER_EMAILS).find(u => u !== username);
  if (!otherUser) return;
  const toEmail = USER_EMAILS[otherUser];
  const mailOptions = {
    from: GMAIL_USER,
    to: toEmail,
    subject: `${username} is now online 💬`,
    text: `${username} just logged into Private Chat.\n\nTime: ${new Date().toLocaleString()}`
  };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("📧 Email failed:", err.message);
    } else {
      console.log("📧 Notification email sent to", toEmail);
    }
  });
}
// ==========================================
// MESSAGE PERSISTENCE (JSONBin) — With data loss protection
// ==========================================
let messageHistory = [];
let loadedSuccessfully = false;  // Safety flag: prevents overwriting if load failed
// ✅ Message protection settings
let loadedSuccessfully = false;  // Prevents overwriting JSONBin if load failed
let saveTimer = null;            // Debounce timer for saves
const MESSAGE_LIMIT = 100;      // Keep last 100 messages (was 15)
const MESSAGE_LIMIT = 100;       // Keep last 100 messages (was 15)
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
      loadedSuccessfully = true;  // ✅ Mark load as successful
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
  console.error("📦 ❌ All 3 load attempts failed. Starting with empty array. SAVES ARE DISABLED to protect existing data.");
  loadedSuccessfully = false;  // ❌ Don't allow saves — would overwrite real data
  console.error("📦 ❌ All 3 load attempts failed. SAVES DISABLED to protect existing data.");
  loadedSuccessfully = false;
  return [];
}
// Debounced save — waits 2 seconds after last message before saving
// This prevents hitting JSONBin rate limits when messages come in rapidly
// Prevents hitting JSONBin rate limits when messages come in rapidly
function scheduleSave() {
  if (!loadedSuccessfully) {
    console.warn("📦 ⚠️ Save skipped — initial load failed. Existing JSONBin data is protected.");
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
    console.log(`📦 Saved ${messageHistory.length} messages to JSONBin.`);
    console.log(`✅ Saved ${messageHistory.length} messages to JSONBin`);
  } catch (err) {
    console.error("📦 Failed to save messages to JSONBin:", err.message);
    console.error("Failed to save messages:", err.message);
  }
}
// Load messages on startup
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
  console.log(`📦 Loaded ${messageHistory.length} messages from JSONBin. Save protection: ${loadedSuccessfully ? 'OFF (saves enabled)' : 'ON (saves blocked)'}`);
  console.log("✅ Loaded", messageHistory.length, "messages. Saves:", loadedSuccessfully ? "ENABLED" : "BLOCKED");
});
// ==========================================
// SOCKET.IO CALL AND CHAT ROUTING
// ==========================================
let users = {}; // username -> socketId
io.on("connection", (socket) => {
  // User Join
  // ======================
  // USER JOIN
  // ======================
  socket.on("user joined", (username) => {
    console.log(`🔵 USER JOINED: ${username} (Socket ID: ${socket.id})`);
    console.log("🔵 USER JOINED:", username); 
    socket.username = username;
    users[username] = socket.id;
    // Send latest chat history to this user
    socket.emit("chat history", messageHistory);
    // Broadcast updated online list
    io.emit("online users", Object.keys(users));
    // Send email notification to the other user
    console.log("🔵 About to send notification");
    sendOnlineNotification(username);
    console.log("🔵 Notification function called");
  });
  socket.on("disconnect", () => {
    if (socket.username) {
      console.log(`🔴 USER DISCONNECTED: ${socket.username}`);
      delete users[socket.username];
      io.emit("online users", Object.keys(users));
    }
    delete users[socket.username];
    io.emit("online users", Object.keys(users));
  });
  // Chat messages
  // ======================
  // CHAT
  // ======================
  socket.on("chat message", (msg) => {
    if (!msg.text || !msg.text.trim()) return;
    msg.id = Date.now();
    msg.time = new Date();
    msg.delivered = true;
    // Store recent messages, keeping the limit
    messageHistory.push(msg);
    if (messageHistory.length > MESSAGE_LIMIT) {
      messageHistory = messageHistory.slice(-MESSAGE_LIMIT);
    }
    // Persist to JSONBin (debounced to avoid rate limits)
    scheduleSave();
    scheduleSave();  // ✅ Debounced save (prevents rate limiting)
    // Broadcast the new message to everyone
    io.emit("chat message", msg);
  });
  // Clear chat history
  // ======================
  // CLEAR HISTORY
  // ======================
  socket.on("clear history", () => {
    console.log("🧹 Clearing chat history...");
    messageHistory = [];
    loadedSuccessfully = true; // Intentional clear — allow the save
    saveMessages();
    io.emit("history cleared");
    console.log("🗑️ Chat history cleared by", socket.username);
  });
  // Message read receipts
  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });
  // Typing indicator
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });
  // ======================
  // WEBRTC CALL SIGNALING
  // CALL FLOW
  // ======================
  // Call initiation
  socket.on("call-user", ({ to, offer, type }) => {
    const calleeSocketId = users[to];
    if (calleeSocketId) {
      console.log(`📞 Forwarding call offer from ${socket.username} to ${to}`);
      io.to(calleeSocketId).emit("incoming-call", {
        from: socket.username,
        offer,
        type
      });
    } else {
      console.log(`📞 Call failed: Callee ${to} is offline.`);
      socket.emit("call-rejected");
    }
    io.to(users[to]).emit("incoming-call", {
      from: socket.username,
      offer,
      type
    });
  });
  // Call answered
  socket.on("call-accepted", ({ to, answer }) => {
    const callerSocketId = users[to];
    if (callerSocketId) {
      console.log(`📞 Call answered by ${socket.username} for ${to}`);
      io.to(callerSocketId).emit("call-answered", answer);
    }
    io.to(users[to]).emit("call-answered", answer);
  });
  // Call rejected
  socket.on("call-rejected", ({ to }) => {
    const callerSocketId = users[to];
    if (callerSocketId) {
      console.log(`❌ Call rejected by ${socket.username} for ${to}`);
      io.to(callerSocketId).emit("call-rejected");
    }
    io.to(users[to]).emit("call-rejected");
  });
  // ICE Candidate exchange
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", candidate);
    }
    io.to(users[to]).emit("ice-candidate", candidate);
  });
  // Call ended
  socket.on("call-ended", ({ to }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      console.log(`🛑 Call ended by ${socket.username} with ${to}`);
      io.to(targetSocketId).emit("call-ended");
    }
    io.to(users[to]).emit("call-ended");
  });
});
// ==========================================
// START SERVER (Dynamic Port Binding)
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});
