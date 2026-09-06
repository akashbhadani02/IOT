require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("../src/routes/auth");
const deviceRoutes = require("../src/routes/devices");

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Device-Token",
      "device-token",
    ],
  })
);

app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ESP8266 IoT Backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    server: "online",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Vercel/serverless-safe MongoDB connection cache.
let dbPromise = global.__mongooseConnectionPromise || null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (!dbPromise) {
    dbPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    global.__mongooseConnectionPromise = dbPromise;
  }

  try {
    await dbPromise;
  } catch (error) {
    dbPromise = null;
    global.__mongooseConnectionPromise = null;
    throw error;
  }

  return mongoose.connection;
}

// IMPORTANT: database connection must happen before any API route query.
app.use(async (req, res, next) => {
  if (req.path === "/" || req.path === "/api/health") {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);
  if (res.headersSent) return next(error);

  res.status(500).json({
    success: false,
    message: "Server error",
  });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error);
      process.exit(1);
    });
}
