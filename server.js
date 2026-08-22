const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));


/* =========================================================
   SUPABASE POSTGRESQL
========================================================= */

/*
  PASTE YOUR SUPABASE DATABASE URL HERE.

  Example:

  const DATABASE_URL =
    "postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-xxxxx.pooler.supabase.com:5432/postgres";
*/

const DATABASE_URL =
  "postgresql://postgres.gjtsarjzpaxsqmdmiuxl:Happyyear@2026@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";


const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }
});


/* =========================================================
   TEST DATABASE CONNECTION
========================================================= */

async function testDatabase() {

  try {

    const result = await pool.query(
      "SELECT NOW()"
    );

    console.log(
      "✅ Supabase PostgreSQL connected"
    );

    console.log(
      "🕒 Database time:",
      result.rows[0].now
    );

  } catch (error) {

    console.error(
      "❌ Supabase PostgreSQL connection failed:"
    );

    console.error(
      error.message
    );

  }

}


/* =========================================================
   LOAD CHAT HISTORY
========================================================= */

async function loadMessages() {

  try {

    const result = await pool.query(`
      SELECT
        id,
        username AS user,
        message AS text,
        created_at AS time
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT 15
    `);


    /*
      Database returns newest first.

      Reverse it so the oldest message
      appears first in the chat.
    */

    return result.rows.reverse();

  } catch (error) {

    console.error(
      "❌ Failed to load chat history:"
    );

    console.error(
      error.message
    );

    return [];

  }

}


/* =========================================================
   SAVE CHAT MESSAGE
========================================================= */

async function saveMessage(msg) {

  try {

    const result = await pool.query(
      `
      INSERT INTO chat_messages
        (username, message)
      VALUES
        ($1, $2)
      RETURNING
        id,
        username AS user,
        message AS text,
        created_at AS time
      `,
      [
        msg.user,
        msg.text
      ]
    );


    return result.rows[0];

  } catch (error) {

    console.error(
      "❌ Failed to save message:"
    );

    console.error(
      error.message
    );

    return null;

  }

}


/* =========================================================
   CLEAR CHAT HISTORY
========================================================= */

async function clearMessages() {

  try {

    await pool.query(
      "DELETE FROM chat_messages"
    );

    console.log(
      "🗑️ All chat history deleted from Supabase"
    );

    return true;

  } catch (error) {

    console.error(
      "❌ Failed to clear chat history:"
    );

    console.error(
      error.message
    );

    return false;

  }

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


/* =========================================================
   USER EMAILS
========================================================= */

const USER_EMAILS = {

  "User 1":
    "YOUR_USER1_EMAIL@gmail.com",

  "User 2":
    "YOUR_USER2_EMAIL@gmail.com"

};


/* =========================================================
   ONLINE EMAIL NOTIFICATION
========================================================= */

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

    from:
      "YOUR_GMAIL@gmail.com",

    to:
      toEmail,

    subject:
      "Amazon Sale is on",

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
   SOCKET.IO
========================================================= */

io.on(
  "connection",
  (socket) => {

    console.log(
      "🔌 New socket connection:",
      socket.id
    );


    /* =====================================================
       USER JOIN
    ===================================================== */

    socket.on(
      "user joined",
      async (username) => {

        console.log(
          "🔵 USER JOINED:",
          username
        );


        socket.username =
          username;


        users[username] =
          socket.id;


        /*
          Load latest 15 messages
          from Supabase.
        */

        const messages =
          await loadMessages();


        /*
          Send history to this user.
        */

        socket.emit(
          "chat history",
          messages
        );


        /*
          Update online users.
        */

        io.emit(
          "online users",
          Object.keys(users)
        );


        /*
          Send email notification.
        */

        sendOnlineNotification(
          username
        );

      }
    );


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      () => {

        console.log(
          "🔴 DISCONNECTED:",
          socket.username
        );


        /*
          Only delete this user if
          this socket is still active.
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


    /* =====================================================
       CHAT MESSAGE
    ===================================================== */

    socket.on(
      "chat message",
      async (msg) => {

        /*
          Validate message.
        */

        if (
          !msg ||
          !msg.text ||
          !msg.text.trim()
        ) {

          return;

        }


        /*
          Save to Supabase.
        */

        const savedMessage =
          await saveMessage({

            user:
              msg.user,

            text:
              msg.text.trim()

          });


        /*
          If database save failed,
          don't broadcast the message.
        */

        if (!savedMessage) {

          console.log(
            "❌ Message was not saved."
          );

          socket.emit(
            "message save failed"
          );

          return;

        }


        /*
          Broadcast saved message
          to both users.
        */

        io.emit(
          "chat message",
          {
            id:
              savedMessage.id,

            user:
              savedMessage.user,

            text:
              savedMessage.text,

            time:
              savedMessage.time,

            delivered:
              true

          }
        );

      }
    );


    /* =====================================================
       CLEAR HISTORY
    ===================================================== */

    socket.on(
      "clear history",
      async () => {

        console.log(
          "🗑️ Clear requested by:",
          socket.username
        );


        const success =
          await clearMessages();


        if (success) {

          /*
            Tell every connected browser
            to clear its screen.
          */

          io.emit(
            "history cleared"
          );


        } else {

          /*
            Tell requester that the
            database deletion failed.
          */

          socket.emit(
            "history clear failed",
            {
              message:
                "Could not clear chat history from Supabase."
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

        const targetSocket =
          users[to];


        if (!targetSocket) {

          console.log(
            "❌ User not online:",
            to
          );

          return;

        }


        io.to(
          targetSocket
        ).emit(
          "incoming-call",
          {
            from:
              socket.username,

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

        const targetSocket =
          users[to];


        if (!targetSocket) {

          return;

        }


        io.to(
          targetSocket
        ).emit(
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

        const targetSocket =
          users[to];


        if (!targetSocket) {

          return;

        }


        io.to(
          targetSocket
        ).emit(
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

        const targetSocket =
          users[to];


        if (!targetSocket) {

          return;

        }


        io.to(
          targetSocket
        ).emit(
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

        const targetSocket =
          users[to];


        if (!targetSocket) {

          return;

        }


        io.to(
          targetSocket
        ).emit(
          "call-ended"
        );

      }
    );

  }
);


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  /*
    Test database first.
  */

  await testDatabase();


  /*
    Render provides PORT.
    Local computer uses 3000.
  */

  const PORT =
    process.env.PORT || 3000;


  server.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log(
        "🚀 Server running on port:",
        PORT
      );

      console.log(
        "🗄️ Chat storage: Supabase PostgreSQL"
      );

    }
  );

}


startServer();
