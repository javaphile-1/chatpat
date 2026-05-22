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

async function loadMessages() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": JSONBIN_API_KEY }
    });
    const data = await res.json();
    console.log("✅ Messages loaded from JSONBin");
    return data.record || [];
  } catch (err) {
    console.error("Failed to load messages:", err);
    return [];
  }
}

async function saveMessages() {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY
      },
      body: JSON.stringify(messageHistory)
    });
    console.log("✅ Messages saved to JSONBin");
  } catch (err) {
    console.error("Failed to save messages:", err);
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
  const otherUser = Object.keys(USER_EMAILS).find(u => u !== username);
  if (!otherUser) return;

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
  console.log("✅ Loaded", messageHistory.length, "messages");
});

io.on("connection", (socket) => {

  // ======================
  // USER JOIN
  // ======================
  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;

    socket.emit("chat history", messageHistory);

    io.emit("online users", Object.keys(users));
    sendOnlineNotification(username);
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
    if (messageHistory.length > 15) {
      messageHistory = messageHistory.slice(-15);
    }

    saveMessages();

    io.emit("chat message", msg);
  });

  // ======================
// CLEAR HISTORY
// ======================
socket.on("clear history", () => {
  messageHistory = [];
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

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
