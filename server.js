const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {}; // username → socketId

io.on("connection", (socket) => {

  // ======================
  // USER JOIN
  // ======================
  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;

    io.emit("online users", Object.keys(users));
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

// CALL INITIATE
socket.on("call-user", ({ to, offer, type }) => {
  io.to(users[to]).emit("incoming-call", {
    from: socket.username,
    offer,
    type
  });
});

// CALL ACCEPTED
socket.on("call-accepted", ({ to, answer }) => {
  io.to(users[to]).emit("call-answered", answer);
});

// CALL REJECTED
socket.on("call-rejected", ({ to }) => {
  io.to(users[to]).emit("call-rejected");
});

// ICE CANDIDATES (FIXED)
socket.on("ice-candidate", ({ to, candidate }) => {
  io.to(users[to]).emit("ice-candidate", candidate);
});

// CALL ENDED
socket.on("call-ended", ({ to }) => {
  io.to(users[to]).emit("call-ended");
});

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
