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

let users = {}; // track online users

io.on("connection", (socket) => {

  socket.emit("load messages", messages);

  socket.on("user joined", (username) => {
    socket.username = username;
    users[socket.id] = username;

    io.emit("online users", Object.values(users));
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("online users", Object.values(users));
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("chat message", (msg) => {

    if (!msg.text || !msg.text.trim()) return;

    msg.id = Date.now();
    msg.time = new Date();

    messages.push(msg);
    if (messages.length > 100) messages.shift();

    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));

    io.emit("chat message", msg);
  });

  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });

  // 📞 CALL SIGNALING
  socket.on("call-user", ({ to, offer }) => {
    socket.to(to).emit("incoming-call", {
      from: socket.id,
      offer
    });
  });

  socket.on("answer-call", ({ to, answer }) => {
    socket.to(to).emit("call-answered", answer);
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", candidate);
  });

});

server.listen(3000, () => {
  console.log("Server running...");
});
