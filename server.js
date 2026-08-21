const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* =========================================================
   CHAT FILE STORAGE
========================================================= */

const CHAT_FILE = path.join(__dirname, "chat-history.json");

let messageHistory = [];

/*
  Load chat history from file
*/
async function loadMessages() {
  try {
    const data = await fs.readFile(CHAT_FILE, "utf8");

    const messages = JSON.parse(data);

    if (Array.isArray(messages)) {
      messageHistory = messages;

      console.log(
        `✅ Loaded ${messageHistory.length} messages from chat-history.json`
      );
    } else {
      messageHistory = [];

      console.log(
        "⚠️ Chat history file does not contain an array. Starting empty."
      );
    }
  } catch (error) {

    /*
      File doesn't exist yet.
      Create it with an empty array.
    */

    if (error.code === "ENOENT") {

      messageHistory = [];

      await saveMessages();

      console.log(
        "📄 chat-history.json created"
      );

    } else {

      console.error(
        "❌ Failed to load chat history:",
        error.message
      );

      messageHistory = [];
    }
  }
}


/*
  Save chat history to file
*/
async function saveMessages() {

  try {

    await fs.writeFile(
      CHAT_FILE,
      JSON.stringify(messageHistory, null, 2),
      "utf8"
    );

    console.log(
      `💾 Saved ${messageHistory.length} messages to chat-history.json`
    );

  } catch (error) {

    console.error(
      "❌ Failed to save chat history:",
      error.message
    );

  }
}


/*
  Clear chat history
*/
async function clearMessages() {

  messageHistory = [];

  await saveMessages();

  console.log(
    "🗑️ Chat history cleared"
  );
}


/* =========================================================
   GMAIL SETUP
========================================================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "YOUR_GMAIL@gmail.com",
    pass: "YOUR_GMAIL_APP_PASSWORD"
  }
});


/*
  IMPORTANT:
  These names must match the usernames
  coming from index.html.
*/

const USER_EMAILS = {
  "User 1": "YOUR_USER1_EMAIL@gmail.com",
  "User 2": "YOUR_USER2_EMAIL@gmail.com"
};


function sendOnlineNotification(username) {

  console.log(
    "📧 Trying to send notification for:",
    username
  );

  const otherUser =
    Object.keys(USER_EMAILS).find(
      user => user !== username
    );

  if (!otherUser) {

    console.log(
      "❌ No other user found"
    );

    return;
  }

  const toEmail =
    USER_EMAILS[otherUser];

  const mailOptions = {

    from: "YOUR_GMAIL@gmail.com",

    to: toEmail,

    subject: "Amazon Sale is on",

    text:
      `Logged in and Grab the offer.\n\n` +
      `Time: ${new Date().toLocaleString()}`
  };


  transporter.sendMail(
    mailOptions,
    (err, info) => {

      if (err) {

        console.error(
          "❌ Email failed:",
          err.message
        );

      } else {

        console.log(
          "✅ Notification sent to",
          toEmail
        );

      }

    }
  );
}


/* =========================================================
   ONLINE USERS
========================================================= */

let users = {};


/* =========================================================
   STARTUP
========================================================= */

async function startServer() {

  /*
    Load file BEFORE accepting connections.
  */

  await loadMessages();


  server.listen(
    3000,
    "0.0.0.0",
    () => {

      console.log(
        "🚀 Server running on port 3000"
      );

      console.log(
        "📄 Chat storage:",
        CHAT_FILE
      );

    }
  );
}


/* =========================================================
   SOCKET.IO
========================================================= */

io.on("connection", (socket) => {

  console.log(
    "🔌 New socket connection:",
    socket.id
  );


  /* =======================================================
     USER JOIN
  ======================================================= */

  socket.on(
    "user joined",
    (username) => {

      console.log(
        "🔵 USER JOINED:",
        username
      );


      socket.username =
        username;


      users[username] =
        socket.id;


      /*
        Send saved history to this user
      */

      socket.emit(
        "chat history",
        messageHistory
      );


      /*
        Update online users
      */

      io.emit(
        "online users",
        Object.keys(users)
      );


      /*
        Send email notification
      */

      sendOnlineNotification(
        username
      );

    }
  );


  /* =======================================================
     DISCONNECT
  ======================================================= */

  socket.on(
    "disconnect",
    () => {

      console.log(
        "🔴 DISCONNECTED:",
        socket.username
      );


      /*
        Only delete this username if
        this socket is still the active socket.
      */

      if (
        socket.username &&
        users[socket.username] === socket.id
      ) {

        delete users[socket.username];

      }


      io.emit(
        "online users",
        Object.keys(users)
      );

    }
  );


  /* =======================================================
     CHAT MESSAGE
  ======================================================= */

  socket.on(
    "chat message",
    async (msg) => {

      if (
        !msg ||
        !msg.text ||
        !msg.text.trim()
      ) {

        return;

      }


      const message = {

        id: Date.now(),

        user: msg.user,

        text: msg.text.trim(),

        time: new Date().toISOString(),

        delivered: true

      };


      /*
        Add message
      */

      messageHistory.push(
        message
      );


      /*
        Keep only latest 15 messages
      */

      if (
        messageHistory.length > 15
      ) {

        messageHistory =
          messageHistory.slice(-15);

      }


      /*
        Save to local file
      */

      await saveMessages();


      /*
        Send to both users
      */

      io.emit(
        "chat message",
        message
      );

    }
  );


  /* =======================================================
     CLEAR HISTORY
  ======================================================= */

  socket.on(
    "clear history",
    async () => {

      try {

        await clearMessages();


        /*
          Tell all connected users
        */

        io.emit(
          "history cleared"
        );


        console.log(
          "🗑️ Chat history cleared by",
          socket.username
        );

      } catch (error) {

        console.error(
          "❌ Failed to clear history:",
          error.message
        );


        socket.emit(
          "history clear failed",
          {
            message:
              "Could not clear chat history."
          }
        );

      }

    }
  );


  /* =======================================================
     MESSAGE SEEN
  ======================================================= */

  socket.on(
    "message seen",
    (id) => {

      socket.broadcast.emit(
        "message seen",
        id
      );

    }
  );


  /* =======================================================
     TYPING
  ======================================================= */

  socket.on(
    "typing",
    (username) => {

      socket.broadcast.emit(
        "typing",
        username
      );

    }
  );


  /* =======================================================
     CALL
  ======================================================= */

  socket.on(
    "call-user",
    ({ to, offer, type }) => {

      const targetSocket =
        users[to];


      if (!targetSocket) {

        console.log(
          "❌ User not online:",
          to
        );

        return;

      }


      io.to(targetSocket).emit(
        "incoming-call",
        {
          from: socket.username,
          offer,
          type
        }
      );

    }
  );


  /* =======================================================
     CALL ACCEPTED
  ======================================================= */

  socket.on(
    "call-accepted",
    ({ to, answer }) => {

      const targetSocket =
        users[to];


      if (!targetSocket) return;


      io.to(targetSocket).emit(
        "call-answered",
        answer
      );

    }
  );


  /* =======================================================
     CALL REJECTED
  ======================================================= */

  socket.on(
    "call-rejected",
    ({ to }) => {

      const targetSocket =
        users[to];


      if (!targetSocket) return;


      io.to(targetSocket).emit(
        "call-rejected"
      );

    }
  );


  /* =======================================================
     ICE CANDIDATE
  ======================================================= */

  socket.on(
    "ice-candidate",
    ({ to, candidate }) => {

      const targetSocket =
        users[to];


      if (!targetSocket) return;


      io.to(targetSocket).emit(
        "ice-candidate",
        candidate
      );

    }
  );


  /* =======================================================
     CALL ENDED
  ======================================================= */

  socket.on(
    "call-ended",
    ({ to }) => {

      const targetSocket =
        users[to];


      if (!targetSocket) return;


      io.to(targetSocket).emit(
        "call-ended"
      );

    }
  );

});


/* =========================================================
   START
========================================================= */

startServer();
```
