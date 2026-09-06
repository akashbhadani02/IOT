const mongoose = require("mongoose");

const pinSchema = new mongoose.Schema({
  pin: { type: String, required: true },
  name: { type: String, default: "Relay" },
  type: { type: String, default: "relay" },
  state: { type: Boolean, default: false }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  deviceId: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  lastSeen: { type: Date, default: null },
  pins: { type: [pinSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);
