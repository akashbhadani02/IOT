const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Device = require("../models/Device");

const router = express.Router();


// =====================================================
// USER AUTHENTICATION
// =====================================================

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }
}


// =====================================================
// ESP8266 DEVICE AUTHENTICATION
// =====================================================

async function deviceAuth(req, res, next) {
  try {
    const token =
      req.headers["x-device-token"] ||
      req.headers["device-token"] ||
      "";

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Device token required"
      });
    }

    const device = await Device.findOne({ token });

    if (!device) {
      return res.status(401).json({
        success: false,
        message: "Invalid device token"
      });
    }

    req.device = device;

    next();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Device authentication failed"
    });
  }
}


// =====================================================
// CREATE DEVICE
// =====================================================

router.post("/", auth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Device name is required"
      });
    }

    const pins = [
      ["D0", "Relay 1"],
      ["D1", "Relay 2"],
      ["D2", "Relay 3"],
      ["D5", "Relay 4"],
      ["D6", "Relay 5"],
      ["D7", "Relay 6"]
    ].map(([pin, pinName]) => ({
      pin,
      name: pinName,
      type: "relay",
      state: false
    }));

    const device = await Device.create({
      userId: req.userId,

      name,

      deviceId:
        "ESP-" +
        crypto.randomBytes(4).toString("hex").toUpperCase(),

      token:
        crypto.randomBytes(24).toString("hex"),

      status: "offline",

      lastSeen: null,

      pins
    });

    res.status(201).json({
      success: true,
      device
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create device"
    });
  }
});


// =====================================================
// GET ALL DEVICES
// =====================================================

router.get("/", auth, async (req, res) => {
  try {
    const devices = await Device
      .find({ userId: req.userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      devices
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get devices"
    });
  }
});


// =====================================================
// GET SINGLE DEVICE
// =====================================================

router.get("/:deviceId", auth, async (req, res) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      userId: req.userId
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    res.json({
      success: true,
      device
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get device"
    });
  }
});


// =====================================================
// WEBSITE → RELAY ON/OFF
// =====================================================
//
// Example:
// PUT /api/devices/ESP-12345678/pin/D0
//
// Body:
// {
//   "state": true
// }
//

router.put("/:deviceId/pin/:pin", auth, async (req, res) => {
  try {
    const { deviceId, pin } = req.params;
    const { state } = req.body;

    if (typeof state !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "state must be true or false"
      });
    }

    const allowedPins = [
      "D0",
      "D1",
      "D2",
      "D5",
      "D6",
      "D7"
    ];

    if (!allowedPins.includes(pin)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pin"
      });
    }

    const device = await Device.findOne({
      deviceId,
      userId: req.userId
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    const selectedPin = device.pins.find(
      p => p.pin === pin
    );

    if (!selectedPin) {
      return res.status(404).json({
        success: false,
        message: "Pin not found"
      });
    }

    selectedPin.state = state;

    await device.save();

    res.json({
      success: true,
      message: `${pin} ${state ? "ON" : "OFF"}`,
      device
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to control relay"
    });
  }
});


// =====================================================
// ESP8266 → GET CURRENT RELAY COMMANDS
// =====================================================
//
// ESP8266 આ API ને વારંવાર call કરશે.
//
// Header:
// x-device-token: DEVICE_TOKEN
//

router.get("/device/commands", deviceAuth, async (req, res) => {
  try {
    const device = req.device;

    device.status = "online";
    device.lastSeen = new Date();

    await device.save();

    res.json({
      success: true,

      deviceId: device.deviceId,

      pins: device.pins.map(pin => ({
        pin: pin.pin,
        state: pin.state
      }))
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get commands"
    });
  }
});


// =====================================================
// ESP8266 → HEARTBEAT
// =====================================================

router.post("/device/heartbeat", deviceAuth, async (req, res) => {
  try {
    const device = req.device;

    device.status = "online";
    device.lastSeen = new Date();

    // ESP current states મોકલી શકે
    if (Array.isArray(req.body.pins)) {

      for (const incomingPin of req.body.pins) {

        const existingPin = device.pins.find(
          p => p.pin === incomingPin.pin
        );

        if (
          existingPin &&
          typeof incomingPin.state === "boolean"
        ) {
          existingPin.state = incomingPin.state;
        }
      }
    }

    await device.save();

    res.json({
      success: true,
      message: "Heartbeat received"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Heartbeat failed"
    });
  }
});


module.exports = router;