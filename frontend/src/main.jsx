import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

const DEFAULT_PINS = [
  { pin: "D0", name: "Relay 1", type: "relay", state: false },
  { pin: "D1", name: "Relay 2", type: "relay", state: false },
  { pin: "D2", name: "Relay 3", type: "relay", state: false },
  { pin: "D5", name: "Relay 4", type: "relay", state: false },
  { pin: "D6", name: "Relay 5", type: "relay", state: false },
  { pin: "D7", name: "Relay 6", type: "relay", state: false },
];

function normalizeDevice(device) {
  if (!device) return null;

  const existingPins = Array.isArray(device.pins) ? device.pins : [];

  return {
    ...device,
    pins: DEFAULT_PINS.map((fallback) => {
      const found = existingPins.find((pin) => pin?.pin === fallback.pin);
      return {
        ...fallback,
        ...(found || {}),
        state: Boolean(found?.state),
      };
    }),
  };
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? "Invalid server response"
        : `Server returned HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (register) {
        await request("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
      }

      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (error) {
      setError(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="login-card">
        <div className="brand-icon">⚡</div>
        <h1>ESP8266 IoT</h1>
        <p className="muted">{register ? "Create your account" : "Login to your dashboard"}</p>

        <form onSubmit={submit}>
          {register && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />

          {error && <div className="error-message">{error}</div>}
          {message && <div className="message">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : register ? "Create Account" : "Login"}
          </button>
        </form>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setRegister((value) => !value);
            setError("");
            setMessage("");
          }}
        >
          {register ? "Already have an account? Login" : "Create a new account"}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(getStoredUser);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [relayLoading, setRelayLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function showError(text) {
    setMessage("");
    setError(text);
  }

  function showMessage(text) {
    setError("");
    setMessage(text);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setDevices([]);
    setSelectedDevice(null);
  }

  async function loadDevices() {
    if (!token) return;

    setLoading(true);
    try {
      const data = await request("/api/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const normalized = (data.devices || []).map(normalizeDevice);
      setDevices(normalized);

      setSelectedDevice((current) => {
        if (current) {
          return normalized.find((device) => device.deviceId === current.deviceId) || normalized[0] || null;
        }
        return normalized[0] || null;
      });
    } catch (error) {
      if (/unauthorized/i.test(error.message)) logout();
      else showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createDevice(event) {
    event.preventDefault();
    const name = deviceName.trim();

    if (!name) {
      showError("Device name is required");
      return;
    }

    setLoading(true);
    try {
      const data = await request("/api/devices", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });

      const device = normalizeDevice(data.device);
      setDevices((current) => [device, ...current.filter((item) => item.deviceId !== device.deviceId)]);
      setSelectedDevice(device);
      setDeviceName("");
      showMessage("Device created successfully");
    } catch (error) {
      if (/unauthorized/i.test(error.message)) logout();
      else showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRelay(pin, currentState) {
    if (!selectedDevice) return;

    const newState = !Boolean(currentState);
    const deviceId = selectedDevice.deviceId;

    // INSTANT UI: change the relay card immediately, without waiting for API.
    const optimistic = {
      ...selectedDevice,
      pins: selectedDevice.pins.map((item) =>
        item.pin === pin ? { ...item, state: newState } : item
      ),
    };
    setSelectedDevice(optimistic);
    setDevices((current) =>
      current.map((device) =>
        device.deviceId === deviceId
          ? {
              ...device,
              pins: device.pins.map((item) =>
                item.pin === pin ? { ...item, state: newState } : item
              ),
            }
          : device
      )
    );
    showMessage(`${pin} ${newState ? "ON" : "OFF"}`);

    // Send to backend in background; UI does not wait.
    setError("");
    try {
      const data = await request(
        `/api/devices/${encodeURIComponent(deviceId)}/pin/${encodeURIComponent(pin)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ state: newState }),
        }
      );

      // Reconcile with server response after it arrives.
      const updated = normalizeDevice(data.device);
      setSelectedDevice((current) =>
        current?.deviceId === deviceId ? updated : current
      );
      setDevices((current) =>
        current.map((device) =>
          device.deviceId === deviceId ? updated : device
        )
      );
    } catch (error) {
      // Roll back only if the server rejected the command.
      setSelectedDevice((current) =>
        current?.deviceId === deviceId
          ? {
              ...current,
              pins: current.pins.map((item) =>
                item.pin === pin ? { ...item, state: Boolean(currentState) } : item
              ),
            }
          : current
      );
      setDevices((current) =>
        current.map((device) =>
          device.deviceId === deviceId
            ? {
                ...device,
                pins: device.pins.map((item) =>
                  item.pin === pin ? { ...item, state: Boolean(currentState) } : item
                ),
              }
            : device
        )
      );
      if (/unauthorized/i.test(error.message)) logout();
      else showError(error.message);
    }
  }

  useEffect(() => {
    if (!token) return;

    loadDevices();
    const timer = setInterval(loadDevices, 3000);
    return () => clearInterval(timer);
  }, [token]);

  if (!token) {
    return <Auth onLogin={(loggedInUser, loggedInToken) => { setUser(loggedInUser); setToken(loggedInToken); }} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>⚡ ESP8266 IoT</h1>
          <span>Relay Control Dashboard</span>
        </div>
        <div className="header-right">
          {user?.name && <span className="user-name">{user.name}</span>}
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <section className="panel">
        <h2>Add Device</h2>
        <form className="add-device" onSubmit={createDevice}>
          <input
            type="text"
            placeholder="Device name"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            maxLength={80}
          />
          <button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Device"}</button>
        </form>
      </section>

      {devices.length > 0 && (
        <section className="panel">
          <h2>Your Devices</h2>
          <div className="devices">
            {devices.map((device) => (
              <button
                key={device.deviceId}
                className={`device ${selectedDevice?.deviceId === device.deviceId ? "selected" : ""}`}
                onClick={() => setSelectedDevice(device)}
              >
                <strong>{device.name || "ESP8266 Device"}</strong>
                <small>{device.deviceId}</small>
                <small>Status: {device.status || "offline"}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && devices.length === 0 && <section className="panel"><p>Loading devices...</p></section>}

      {selectedDevice && (
        <section className="panel">
          <div className="device-title">
            <div>
              <h2>{selectedDevice.name || "ESP8266 Device"}</h2>
              <p>Device ID: {selectedDevice.deviceId}</p>
            </div>
            <div className={`status ${selectedDevice.status === "online" ? "online" : "offline"}`}>
              {selectedDevice.status || "offline"}
            </div>
          </div>

          <div className="relay-grid">
            {selectedDevice.pins.map((pin, index) => {
              const state = Boolean(pin.state);
              return (
                <div className={`relay-card ${state ? "on" : ""}`} key={pin.pin}>
                  <div className="relay-number">Relay {index + 1}</div>
                  <h3>{pin.pin}</h3>
                  <div className={`relay-state ${state ? "on-text" : ""}`}>{state ? "ON" : "OFF"}</div>
                  <button
                    className={`relay-button ${state ? "on-button" : ""}`}
                    onClick={() => toggleRelay(pin.pin, state)}
                  >
                    {state ? "TURN OFF" : "TURN ON"}
                  </button>
                </div>
              );
            })}
          </div>

          <details className="token-box">
            <summary>Device Token (for ESP8266)</summary>
            <code>{selectedDevice.token}</code>
          </details>
        </section>
      )}

      {!loading && devices.length === 0 && (
        <section className="empty">
          <h2>No devices found</h2>
          <p>Add your first ESP8266 device above.</p>
        </section>
      )}
    </div>
  );
}

export default App;


createRoot(document.getElementById("root")).render(<App />);
