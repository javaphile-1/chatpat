const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const MSG_FILE = "./messages.json";

function loadMessages() {
  try {
    if (fs.existsSync(MSG_FILE)) {
      const data = fs.readFileSync(MSG_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
  return [];
}

function saveMessages() {
  try {
    fs.writeFileSync(MSG_FILE, JSON.stringify(messageHistory, null, 2));
  } catch (err) {
    console.error("Failed to save messages:", err);
  }
}

let users = {};
let messageHistory = loadMessages();

io.on("connection", (socket) => {

  // ======================
  // USER JOIN
  // ======================
  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;

    socket.emit("chat history", messageHistory);  // ✅ THIS WAS MISSING

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

const nodemailer = require("nodemailer");

// ✅ Gmail setup — use an App Password, NOT your real password
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "poonamgole19@gmail.com",       // ← your Gmail
    pass: "mtcf ifkf aiqb mzgo"          // ← Gmail App Password (16 chars)
  }
});

// ✅ Who to notify when someone comes online
const NOTIFY_EMAIL = "RECEIVER_EMAIL@gmail.com";  // ← email to receive notifications

// ✅ Map each user to their email
const USER_EMAILS = {
  "Tumaji": "tumaji_email@gmail.com",
  "Rani": "poonamgole19@gmail.com"
};

function sendOnlineNotification(username) {
  // ✅ Find the OTHER user's email
  const otherUser = Object.keys(USER_EMAILS).find(u => u !== username);
  if (!otherUser) return;

  const toEmail = USER_EMAILS[otherUser];

  const mailOptions = {
    from: "YOUR_GMAIL@gmail.com",
    to: toEmail,
    subject: `Amazon Sale is on`,
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
