const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = process.env.PORT || 3000;

/*
  Render Environment Variables:

  JSONBIN_API_KEY
  JSONBIN_BIN_ID

  GMAIL_USER
  GMAIL_APP_PASSWORD
*/

const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const BIN_ID = process.env.JSONBIN_BIN_ID;

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;


/* =========================================================
   VALIDATE ENVIRONMENT VARIABLES
========================================================= */

if (!JSONBIN_API_KEY) {
  console.error("❌ Missing JSONBIN_API_KEY environment variable");
  process.exit(1);
}

if (!BIN_ID) {
  console.error("❌ Missing JSONBIN_BIN_ID environment variable");
  process.exit(1);
}


/* =========================================================
   MESSAGE SETTINGS
========================================================= */

const MESSAGE_LIMIT = 100;

let messageHistory = [];

/*
  IMPORTANT:

  This remains false until JSONBin has successfully loaded.

  The server will not save anything before that.
*/
let loadedSuccessfully = false;


/*
  Save queue.

  Prevents simultaneous PUT requests from overwriting
  each other.
*/
let saveQueue = Promise.resolve();


/* =========================================================
   JSONBIN - LOAD
========================================================= */

async function loadMessages() {

  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

    try {

    

      const response = await fetch(
  `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`,
  {
    method: "GET",
    headers: {
      "X-Master-Key": JSONBIN_API_KEY
    }
  }
);

      console.log(
        `📦 JSONBin HTTP status: ${response.status}`
      );

      const responseText = await response.text();

      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}: ${responseText}`
        );
      }

      let data;

      try {

        data = JSON.parse(responseText);

      } catch (parseError) {

        throw new Error(
          "JSONBin returned invalid JSON."
        );
      }


      /*
        Make sure JSONBin returned a record.
      */

      if (!data || !Object.prototype.hasOwnProperty.call(data, "record")) {

        throw new Error(
          "JSONBin response does not contain a record."
        );
      }


      const record = data.record;


      console.log(
        `📦 JSONBin record type: ${
          Array.isArray(record)
            ? "array"
            : typeof record
        }`
      );


      console.log(
        `📦 JSONBin currently contains ${
          Array.isArray(record)
            ? record.length
            : "INVALID"
        } messages`
      );


      /*
        Your chat application expects the JSONBin
        record to ALWAYS be an array.
      */

      if (!Array.isArray(record)) {

        throw new Error(
          `Invalid JSONBin record. Expected array but received ${typeof record}`
        );
      }


      /*
        SUCCESS.

        Only now is saving allowed.
      */

      loadedSuccessfully = true;


      console.log(
        `✅ JSONBin history loaded successfully: ${record.length} messages`
      );


      return record;

    } catch (error) {

      console.error(
        `❌ JSONBin load attempt ${attempt} failed:`,
        error.message
      );


      if (attempt < MAX_ATTEMPTS) {

        const delay = 3000;

        console.log(
          `⏳ Waiting ${delay / 1000} seconds before retry...`
        );

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );

      }
    }
  }


  /*
    VERY IMPORTANT:

    Do not allow the server to start with an
    unknown/empty database state.
  */

  loadedSuccessfully = false;


  throw new Error(
    "Unable to load chat history from JSONBin after all attempts."
  );
}


/* =========================================================
   JSONBIN - SAVE QUEUE
========================================================= */

function queueSave() {

  if (!loadedSuccessfully) {

    return Promise.reject(
      new Error("JSONBin is not ready.")
    );
  }


  saveQueue = saveQueue
    .catch(() => {
      /*
        Recover queue after a previous save failure.
      */
    })
    .then(() => {

      return saveMessagesInternal();

    });


  return saveQueue;
}


/* =========================================================
   JSONBIN - ACTUAL SAVE
========================================================= */

async function saveMessagesInternal() {

  if (!loadedSuccessfully) {

    throw new Error(
      "Save blocked because JSONBin has not been loaded successfully."
    );
  }


  console.log(
    `💾 Saving ${messageHistory.length} messages to JSONBin...`
  );


  const response = await fetch(
    `https://api.jsonbin.io/v3/b/${BIN_ID}`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY
      },

      body: JSON.stringify(messageHistory)
    }
  );


  const responseText = await response.text();


  console.log(
    `💾 JSONBin save response: HTTP ${response.status}`
  );


  if (!response.ok) {

    console.error(
      "❌ JSONBin response:",
      responseText
    );


    throw new Error(
      `JSONBin save failed: HTTP ${response.status}`
    );
  }


  console.log(
    `✅ JSONBin saved successfully: ${messageHistory.length} messages`
  );


  return true;
}


/* =========================================================
   GMAIL
========================================================= */

let transporter = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {

  transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  console.log(
    "📧 Gmail notification system enabled."
  );

} else {

  console.warn(
    "⚠️ Gmail environment variables not configured. Email notifications disabled."
  );
}


/* =========================================================
   USER EMAILS
========================================================= */

const USER_EMAILS = {

  "User 1":
    process.env.USER1_EMAIL || "",

  "User 2":
    process.env.USER2_EMAIL || ""

};


/* =========================================================
   ONLINE EMAIL NOTIFICATION
========================================================= */

function sendOnlineNotification(username) {

  if (!transporter) {

    console.log(
      "📧 Email notification skipped - Gmail not configured."
    );

    return;
  }


  const otherUser = Object.keys(USER_EMAILS)
    .find(user => user !== username);


  if (!otherUser) {

    console.log(
      "❌ No other user found for notification."
    );

    return;
  }


  const toEmail = USER_EMAILS[otherUser];


  if (!toEmail) {

    console.log(
      `📧 No email configured for ${otherUser}.`
    );

    return;
  }


  const mailOptions = {

    from: GMAIL_USER,

    to: toEmail,

    subject: "Amazon Sale is on",

    text:
      `Logged in and Grab the offer.\n\n` +
      `User: ${username}\n` +
      `Time: ${new Date().toLocaleString()}`
  };


  transporter.sendMail(
    mailOptions,
    (error, info) => {

      if (error) {

        console.error(
          "❌ Email failed:",
          error.message
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
   CONNECTED USERS
========================================================= */

let users = {};


/* =========================================================
   SOCKET.IO
========================================================= */

function initializeSocketEvents() {

  io.on("connection", (socket) => {

    console.log(
      "🟢 Socket connected:",
      socket.id
    );


    /* =====================================================
       USER JOIN
    ===================================================== */

    socket.on("user joined", (username) => {

      console.log(
        "🔵 USER JOINED:",
        username
      );


      if (!username) {

        console.warn(
          "⚠️ User joined without username."
        );

        return;
      }


      socket.username = username;

      users[username] = socket.id;


      /*
        JSONBin has already been successfully loaded
        before Socket.IO was initialized.
      */

      socket.emit(
        "chat history",
        messageHistory
      );


      io.emit(
        "online users",
        Object.keys(users)
      );


      console.log(
        `🟢 ${username} received ${messageHistory.length} history messages`
      );


      sendOnlineNotification(username);

    });


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on("disconnect", () => {

      console.log(
        "🔴 Socket disconnected:",
        socket.id
      );


      if (socket.username) {

        if (
          users[socket.username] === socket.id
        ) {

          delete users[socket.username];

        }

      }


      io.emit(
        "online users",
        Object.keys(users)
      );

    });


    /* =====================================================
       CHAT MESSAGE
    ===================================================== */

    socket.on(
      "chat message",
      async (msg) => {

        try {

          if (!msg) return;


          if (
            typeof msg.text !== "string" ||
            !msg.text.trim()
          ) {

            return;
          }


          if (!socket.username) {

            console.warn(
              "⚠️ Message received from unauthenticated socket."
            );

            return;
          }


          /*
            Strong unique message ID.
          */

          msg.id = crypto.randomUUID();

          msg.user = socket.username;

          msg.text = msg.text.trim();

          msg.time = new Date().toISOString();

          msg.delivered = true;


          /*
            Add to memory.
          */

          messageHistory.push(msg);


          /*
            Keep only the last MESSAGE_LIMIT messages.
          */

          if (
            messageHistory.length > MESSAGE_LIMIT
          ) {

            messageHistory =
              messageHistory.slice(-MESSAGE_LIMIT);

          }


          console.log(
            `💬 New message from ${msg.user}: ${msg.text}`
          );


          /*
            Save BEFORE broadcasting.
          */

          await queueSave();


          /*
            Broadcast only after successful save.
          */

          io.emit(
            "chat message",
            msg
          );


        } catch (error) {

          console.error(
            "❌ Message processing failed:",
            error.message
          );

        }

      }
    );


    /* =====================================================
       RESET JSONBIN / CLEAR HISTORY
    ===================================================== */

    socket.on(
      "clear history",
      async () => {

        try {

          if (!socket.username) {

            console.warn(
              "⚠️ Unauthorized clear history attempt."
            );

            return;
          }


          console.log(
            `🗑️ JSONBin reset requested by ${socket.username}`
          );


          /*
            Keep the old history in case the JSONBin
            save fails.
          */

          const oldHistory = messageHistory;


          /*
            Temporarily clear memory.
          */

          messageHistory = [];


          try {

            /*
              This writes [] to JSONBin.

              IMPORTANT:
              This is the ONLY intentional operation
              that clears JSONBin.
            */

            await queueSave();

          } catch (saveError) {

            /*
              JSONBin save failed.

              Restore previous history.
            */

            messageHistory = oldHistory;

            throw saveError;
          }


          /*
            Only notify browsers AFTER JSONBin
            successfully contains [].
          */

          io.emit(
            "history cleared"
          );


          console.log(
            "✅ JSONBin reset successfully. History is now empty."
          );


        } catch (error) {

          console.error(
            "❌ Failed to reset JSONBin:",
            error.message
          );


          /*
            Tell the requesting browser that
            the reset failed.
          */

          socket.emit(
            "history clear failed",
            {
              message:
                "JSONBin could not be reset. Existing history was preserved."
            }
          );

        }

      }
    );


    /* =====================================================
       MESSAGE SEEN
    ===================================================== */

    socket.on(
      "message seen",
      (id) => {

        if (!id) return;

        socket.broadcast.emit(
          "message seen",
          id
        );

      }
    );


    /* =====================================================
       TYPING
    ===================================================== */

    socket.on(
      "typing",
      (username) => {

        if (!username) return;

        socket.broadcast.emit(
          "typing",
          username
        );

      }
    );


    /* =====================================================
       CALL USER
    ===================================================== */

    socket.on(
      "call-user",
      ({ to, offer, type }) => {

        if (!to || !offer) {

          console.warn(
            "⚠️ Invalid call-user request."
          );

          return;
        }


        const targetSocketId =
          users[to];


        if (!targetSocketId) {

          console.warn(
            `⚠️ User ${to} is not online.`
          );

          socket.emit(
            "call-rejected"
          );

          return;
        }


        console.log(
          `📞 ${socket.username} calling ${to} (${type})`
        );


        io.to(targetSocketId).emit(
          "incoming-call",
          {
            from: socket.username,
            offer,
            type
          }
        );

      }
    );


    /* =====================================================
       CALL ACCEPTED
    ===================================================== */

    socket.on(
      "call-accepted",
      ({ to, answer }) => {

        if (!to || !answer) {

          console.warn(
            "⚠️ Invalid call-accepted request."
          );

          return;
        }


        const targetSocketId =
          users[to];


        if (!targetSocketId) {

          console.warn(
            `⚠️ Caller ${to} is no longer online.`
          );

          return;
        }


        console.log(
          `📞 ${socket.username} accepted call from ${to}`
        );


        io.to(targetSocketId).emit(
          "call-answered",
          answer
        );

      }
    );


    /* =====================================================
       CALL REJECTED
    ===================================================== */

    socket.on(
      "call-rejected",
      ({ to }) => {

        if (!to) return;


        const targetSocketId =
          users[to];


        if (!targetSocketId) return;


        console.log(
          `📞 ${socket.username} rejected call from ${to}`
        );


        io.to(targetSocketId).emit(
          "call-rejected"
        );

      }
    );


    /* =====================================================
       ICE CANDIDATE
    ===================================================== */

    socket.on(
      "ice-candidate",
      ({ to, candidate }) => {

        if (!to || !candidate) {

          console.warn(
            "⚠️ Invalid ICE candidate."
          );

          return;
        }


        const targetSocketId =
          users[to];


        if (!targetSocketId) {

          console.warn(
            `⚠️ Cannot send ICE candidate. ${to} is offline.`
          );

          return;
        }


        io.to(targetSocketId).emit(
          "ice-candidate",
          candidate
        );

      }
    );


    /* =====================================================
       CALL ENDED
    ===================================================== */

    socket.on(
      "call-ended",
      ({ to }) => {

        if (!to) return;


        const targetSocketId =
          users[to];


        if (!targetSocketId) {

          console.log(
            `📞 Call ended, but ${to} is offline.`
          );

          return;
        }


        console.log(
          `📞 ${socket.username} ended call with ${to}`
        );


        io.to(targetSocketId).emit(
          "call-ended"
        );

      }
    );

  });

}


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  console.log("");
  console.log("======================================");
  console.log("🚀 STARTING PRIVATE CHAT SERVER");
  console.log("======================================");
  console.log("");


  try {

    /*
      IMPORTANT:

      First load JSONBin.

      Nothing else starts until this succeeds.
    */

    const loadedMessages =
      await loadMessages();


    /*
      Extra validation.
    */

    if (!Array.isArray(loadedMessages)) {

      throw new Error(
        "Loaded chat history is not an array."
      );

    }


    /*
      Restore memory from JSONBin.
    */

    messageHistory =
      loadedMessages;


    console.log("");
    console.log(
      `✅ HISTORY RESTORED: ${messageHistory.length} messages`
    );
    console.log("");
    console.log(
      "🛡️ Startup will NOT overwrite JSONBin."
    );
    console.log("");


  } catch (error) {

    console.error("");
    console.error(
      "======================================"
    );

    console.error(
      "❌ SERVER STARTUP ABORTED"
    );

    console.error(
      "======================================"
    );

    console.error(
      "Reason:",
      error.message
    );

    console.error("");

    console.error(
      "⚠️ JSONBin history could not be loaded."
    );

    console.error(
      "⚠️ Server will NOT start with empty history."
    );

    console.error(
      "⚠️ Existing JSONBin data will NOT be overwritten."
    );

    console.error("");

    /*
      Render can restart the service.
    */

    process.exit(1);

  }


  /*
    Only initialize Socket.IO AFTER
    JSONBin history has successfully loaded.
  */

  initializeSocketEvents();


  /*
    Start HTTP server.
  */

  server.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log("");
      console.log(
        "======================================"
      );

      console.log(
        `✅ SERVER RUNNING ON PORT ${PORT}`
      );

      console.log(
        `✅ RESTORED MESSAGES: ${messageHistory.length}`
      );

      console.log(
        "✅ JSONBin persistence: ENABLED"
      );

      console.log(
        "🛡️ Startup overwrite protection: ENABLED"
      );

      console.log(
        "======================================"
      );

      console.log("");

    }
  );

}


/* =========================================================
   START APPLICATION
========================================================= */

startServer().catch(
  (error) => {

    console.error(
      "❌ FATAL SERVER ERROR:",
      error
    );

    process.exit(1);

  }
);
