const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {}; // username -> socketId

io.on("connection", (socket) => {

  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;
    io.emit("online users", Object.keys(users));
  });

  socket.on("disconnect", () => {
    delete users[socket.username];
    io.emit("online users", Object.keys(users));
  });

  // =====================
  // CALL FLOW
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

server.listen(3000);
