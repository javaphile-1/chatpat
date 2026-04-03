const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let messages = [];

try {
  const data = fs.readFileSync("messages.json", "utf-8");
  messages = data ? JSON.parse(data) : [];
} catch {
  messages = [];
}

let users = {}; // username -> socket.id

io.on("connection", (socket) => {

  socket.emit("load messages", messages);

  socket.on("user joined", (username) => {
    socket.username = username;
    users[username] = socket.id;
    io.emit("online users", Object.keys(users));
  });

  socket.on("disconnect", () => {
    delete users[socket.username];
    io.emit("online users", Object.keys(users));
  });

  socket.on("chat message", (msg) => {

    if (!msg.text || !msg.text.trim()) return;

    msg.id = Date.now();
    msg.time = new Date();
    msg.delivered = true;

    messages.push(msg);
    if (messages.length > 100) messages.shift();

    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));

    io.emit("chat message", msg);
  });

  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // CALL EVENTS
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

});

server.listen(3000);
