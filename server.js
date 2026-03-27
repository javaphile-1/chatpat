const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Load messages from file
let messages = [];
try {
  messages = JSON.parse(fs.readFileSync("messages.json"));
} catch (err) {
  messages = [];
}

io.on("connection", (socket) => {

  // Send old messages to new user
  socket.emit("load messages", messages);

  socket.on("user joined", (username) => {
    socket.username = username;
  });

  socket.on("chat message", (msg) => {

    msg.id = Date.now(); // unique id

    messages.push(msg);

    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }

    // Save to file
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));

    io.emit("chat message", msg);
  });

  // ✅ READ RECEIPT
  socket.on("message seen", (id) => {
    io.emit("message seen", id);
  });

});

server.listen(3000, () => {
  console.log("Server running...");
});
