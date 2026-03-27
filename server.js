const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Load messages
let messages = [];
try {
  messages = JSON.parse(fs.readFileSync("messages.json"));
} catch {
  messages = [];
}

io.on("connection", (socket) => {

  socket.emit("load messages", messages);

  socket.on("user joined", (username) => {
    socket.username = username;
  });

  // ✅ Typing indicator
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("chat message", (msg) => {

    msg.id = Date.now();

    messages.push(msg);

    if (messages.length > 100) {
      messages.shift();
    }

    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));

    io.emit("chat message", msg);
  });

  // ✅ Read receipt
  socket.on("message seen", (id) => {
    socket.broadcast.emit("message seen", id);
  });

});

server.listen(3000, () => {
  console.log("Server running...");
});
