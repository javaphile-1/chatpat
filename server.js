const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {};
let messages = [];

io.on("connection", (socket) => {

  // =====================
  // USER JOIN
  // =====================
  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;

    io.emit("online users", Object.keys(users));
    socket.emit("load messages", messages);
  });

  socket.on("disconnect", () => {
    delete users[socket.username];
    io.emit("online users", Object.keys(users));
  });

  // =====================
  // CHAT
  // =====================
  socket.on("chat message", (msg) => {

    if (!msg.text.trim()) return;

    msg.id = Date.now();
    msg.time = new Date();
    msg.delivered = true;

    messages.push(msg);
    if (messages.length > 100) messages.shift();

    io.emit("chat message", msg);
  });

  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // =====================
  // CALL FLOW (unchanged)
  // =====================
  socket.on("call-user", ({ offer, type }) => {
    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("incoming-call", {
      from: socket.username,
      offer,
      type
    });
  });

  socket.on("call-accepted", ({ answer }) => {
    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("call-answered", answer);
  });

  socket.on("call-rejected", () => {
    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("call-rejected");
  });

  socket.on("ice-candidate", ({ candidate }) => {
    let otherUser = Object.keys(users).find(u => u !== socket.username);
    if (!otherUser) return;

    io.to(users[otherUser]).emit("ice-candidate", candidate);
  });

});

server.listen(3000, () => {
  console.log("Server running...");
});
