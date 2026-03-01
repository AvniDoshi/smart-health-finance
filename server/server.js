require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const assistantRoutes = require("./assistant");

require("./db"); // init db + tables
const api = require("./routes");

const app = express();
app.set('trust proxy', 1);

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

// Serve your HTML/CSS
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes
app.use("/api", api);
app.use("/api/assistant", assistantRoutes);

// Optional health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running: http://localhost:${port}`));