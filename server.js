const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {

  socket.on("user joined", (username) => {
    socket.username = username;
    io.emit("chat message", { user: "System", text: username + " joined the chat" });
  });

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("chat message", { user: "System", text: socket.username + " left the chat" });
    }
  });

});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});