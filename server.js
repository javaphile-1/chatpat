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
  socket.on("call-user", ({ offer, type }) => {

    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("incoming-call", {
      from: socket.username,
      offer,
      type
    });
  });

  // CALL ACCEPTED
  socket.on("call-accepted", ({ answer }) => {

    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("call-answered", answer);
  });

  // CALL REJECTED
  socket.on("call-rejected", () => {

    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("call-rejected");
  });

  // ICE CANDIDATES
  socket.on("ice-candidate", ({ candidate }) => {

    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("ice-candidate", candidate);
  });

  // CALL ENDED (VERY IMPORTANT)
  socket.on("call-ended", () => {

    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("call-ended");
  });

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
