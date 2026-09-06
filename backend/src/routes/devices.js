const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Device = require("../models/Device");

const router = express.Router();

const ALLOWED_PINS = ["D0", "D1", "D2", "D5", "D6", "D7"];
const DEFAULT_PINS = ALLOWED_PINS.map((pin, index) => ({
  pin,
  name: `Relay ${index + 1}`,
  type: "relay",
  state: false,
}));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

async function deviceAuth(req, res, next) {
  try {
    const token = req.headers["x-device-token"] || req.headers["device-token"] || "";

    if (!token) {
      return res.status(401).json({ success: false, message: "Device token required" });
    }

    const device = await Device.findOne({ token });
    if (!device) {
      return res.status(401).json({ success: false, message: "Invalid device token" });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error("Device auth error:", error);
    res.status(500).json({ success: false, message: "Device authentication failed" });
  }
}

function normalizePin(pin) {
  return String(pin || "").trim().toUpperCase();
}

function normalizePins(pins) {
  const existing = Array.isArray(pins) ? pins : [];
  return DEFAULT_PINS.map((fallback) => {
    const found = existing.find((item) => normalizePin(item?.pin) === fallback.pin);
    return {
      ...fallback,
      ...(found || {}),
      pin: fallback.pin,
      type: "relay",
      state: Boolean(found?.state),
    };
  });
}

function publicDevice(device) {
  const obj = device.toObject ? device.toObject() : device;
  return {
    ...obj,
    pins: normalizePins(obj.pins),
  };
}

function commandsFor(device) {
  return normalizePins(device.pins).map(({ pin, state }) => ({ pin, state }));
}

// =====================================================
// USER -> CREATE DEVICE
// POST /api/devices
// Body: { "name": "My ESP8266" }
// =====================================================
router.post("/", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ success: false, message: "Device name is required" });
    }

    const device = await Device.create({
      userId: req.userId,
      name: name.slice(0, 80),
      deviceId: `ESP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      token: crypto.randomBytes(24).toString("hex"),
      status: "offline",
      lastSeen: null,
      pins: DEFAULT_PINS,
    });

    res.status(201).json({ success: true, device: publicDevice(device) });
  } catch (error) {
    console.error("Create device error:", error);
    res.status(500).json({ success: false, message: "Failed to create device" });
  }
});

// =====================================================
// USER -> LIST DEVICES
// GET /api/devices
// =====================================================
router.get("/", auth, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, devices: devices.map(publicDevice) });
  } catch (error) {
    console.error("List devices error:", error);
    res.status(500).json({ success: false, message: "Failed to get devices" });
  }
});

// =====================================================
// ESP -> COMMANDS
// GET /api/devices/device/commands
// Header: X-Device-Token: DEVICE_TOKEN
// =====================================================
router.get("/device/commands", deviceAuth, async (req, res) => {
  try {
    const device = req.device;
    device.status = "online";
    device.lastSeen = new Date();
    await device.save();

    res.json({
      success: true,
      deviceId: device.deviceId,
      status: device.status,
      serverTime: new Date().toISOString(),
      pins: commandsFor(device),
    });
  } catch (error) {
    console.error("Get commands error:", error);
    res.status(500).json({ success: false, message: "Failed to get commands" });
  }
});

// =====================================================
// ESP -> STATUS / CURRENT STATE
// GET /api/devices/device/status
// Header: X-Device-Token: DEVICE_TOKEN
// =====================================================
router.get("/device/status", deviceAuth, async (req, res) => {
  try {
    const device = req.device;
    res.json({
      success: true,
      deviceId: device.deviceId,
      name: device.name,
      status: device.status,
      lastSeen: device.lastSeen,
      pins: commandsFor(device),
    });
  } catch (error) {
    console.error("Device status error:", error);
    res.status(500).json({ success: false, message: "Failed to get device status" });
  }
});

// =====================================================
// ESP -> HEARTBEAT + ACTUAL PIN STATES
// POST /api/devices/device/heartbeat
// Header: X-Device-Token: DEVICE_TOKEN
// Body: { "pins": [{"pin":"D0","state":true}, ...] }
// =====================================================
router.post("/device/heartbeat", deviceAuth, async (req, res) => {
  try {
    const device = req.device;
    const incomingPins = Array.isArray(req.body?.pins) ? req.body.pins : [];

    for (const incoming of incomingPins) {
      const pin = normalizePin(incoming?.pin);
      const existing = device.pins.find((item) => normalizePin(item.pin) === pin);

      if (existing && typeof incoming.state === "boolean") {
        existing.state = incoming.state;
      }
    }

    device.status = "online";
    device.lastSeen = new Date();
    await device.save();

    res.json({
      success: true,
      message: "Heartbeat received",
      deviceId: device.deviceId,
      serverTime: new Date().toISOString(),
      pins: commandsFor(device),
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ success: false, message: "Heartbeat failed" });
  }
});

// =====================================================
// USER -> GET SINGLE DEVICE
// GET /api/devices/:deviceId
// =====================================================
router.get("/:deviceId", auth, async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      userId: req.userId,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    res.json({ success: true, device: publicDevice(device) });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({ success: false, message: "Failed to get device" });
  }
});

// =====================================================
// USER -> SET ONE RELAY
// PUT /api/devices/:deviceId/pin/:pin
// Body: { "state": true }
// =====================================================
router.put("/:deviceId/pin/:pin", auth, async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || "").trim();
    const pin = normalizePin(req.params.pin);
    const state = req.body?.state;

    if (!ALLOWED_PINS.includes(pin)) {
      return res.status(400).json({ success: false, message: `Invalid pin. Use: ${ALLOWED_PINS.join(", ")}` });
    }

    if (typeof state !== "boolean") {
      return res.status(400).json({ success: false, message: "state must be true or false" });
    }

    const device = await Device.findOne({ deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const selectedPin = device.pins.find((item) => normalizePin(item.pin) === pin);
    if (!selectedPin) {
      return res.status(404).json({ success: false, message: "Pin not found" });
    }

    selectedPin.state = state;
    await device.save();

    res.json({
      success: true,
      message: `${pin} ${state ? "ON" : "OFF"}`,
      deviceId: device.deviceId,
      pin,
      state,
      device: publicDevice(device),
    });
  } catch (error) {
    console.error("Set relay error:", error);
    res.status(500).json({ success: false, message: "Failed to control relay" });
  }
});

// =====================================================
// USER -> SET MULTIPLE RELAYS AT ONCE
// PUT /api/devices/:deviceId/pins
// Body: { "pins": [{"pin":"D0","state":true}, ...] }
// =====================================================
router.put("/:deviceId/pins", auth, async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const pins = req.body?.pins;
    if (!Array.isArray(pins) || pins.length === 0) {
      return res.status(400).json({ success: false, message: "pins must be a non-empty array" });
    }

    for (const item of pins) {
      const pin = normalizePin(item?.pin);
      if (!ALLOWED_PINS.includes(pin) || typeof item?.state !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `Each pin must contain a valid pin (${ALLOWED_PINS.join(", ")}) and boolean state`,
        });
      }
    }

    for (const item of pins) {
      const pin = normalizePin(item.pin);
      const existing = device.pins.find((entry) => normalizePin(entry.pin) === pin);
      if (existing) existing.state = item.state;
    }

    await device.save();

    res.json({
      success: true,
      message: "Relay states updated",
      deviceId: device.deviceId,
      pins: commandsFor(device),
      device: publicDevice(device),
    });
  } catch (error) {
    console.error("Set multiple relays error:", error);
    res.status(500).json({ success: false, message: "Failed to update relay states" });
  }
});

// =====================================================
// USER -> TOGGLE ONE RELAY
// POST /api/devices/:deviceId/pin/:pin/toggle
// =====================================================
router.post("/:deviceId/pin/:pin/toggle", auth, async (req, res) => {
  try {
    const pin = normalizePin(req.params.pin);
    if (!ALLOWED_PINS.includes(pin)) {
      return res.status(400).json({ success: false, message: "Invalid pin" });
    }

    const device = await Device.findOne({ deviceId: req.params.deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const selectedPin = device.pins.find((item) => normalizePin(item.pin) === pin);
    if (!selectedPin) {
      return res.status(404).json({ success: false, message: "Pin not found" });
    }

    selectedPin.state = !Boolean(selectedPin.state);
    await device.save();

    res.json({
      success: true,
      message: `${pin} ${selectedPin.state ? "ON" : "OFF"}`,
      deviceId: device.deviceId,
      pin,
      state: selectedPin.state,
      device: publicDevice(device),
    });
  } catch (error) {
    console.error("Toggle relay error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle relay" });
  }
});

module.exports = router;
