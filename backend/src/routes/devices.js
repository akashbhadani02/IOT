const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Device = require("../models/Device");

const router = express.Router();

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

router.post("/", auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Device name is required" });

    const pins = [
      ["D0", "Relay 1"], ["D1", "Relay 2"], ["D2", "Relay 3"],
      ["D5", "Relay 4"], ["D6", "Relay 5"], ["D7", "Relay 6"]
    ].map(([pin, pinName]) => ({ pin, name: pinName, type: "relay", state: false }));

    const device = await Device.create({
      userId: req.userId,
      name,
      deviceId: "ESP-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
      token: crypto.randomBytes(24).toString("hex"),
      pins
    });

    res.status(201).json({ success: true, device });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Failed to create device" });
  }
});

router.get("/", auth, async (req, res) => {
  const devices = await Device.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ success: true, devices });
});

router.get("/:deviceId", auth, async (req, res) => {
  const device = await Device.findOne({ deviceId: req.params.deviceId, userId: req.userId });
  if (!device) return res.status(404).json({ success: false, message: "Device not found" });
  res.json({ success: true, device });
});

module.exports = router;
