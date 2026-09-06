require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("../src/routes/auth");
const deviceRoutes = require("../src/routes/devices");

const app = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "ESP8266 IoT Backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);

let cached = global.__mongooseConnection;
async function connectDB() {
  if (cached && cached.readyState === 1) return cached;
  cached = await mongoose.connect(process.env.MONGO_URI);
  global.__mongooseConnection = cached;
  return cached;
}

app.use(async (req, res, next) => {
  if (req.path === "/") return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  });
}
