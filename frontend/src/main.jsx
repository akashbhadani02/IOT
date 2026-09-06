import { useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

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

  const existingPins = Array.isArray(device.pins)
    ? device.pins
    : [];

  const pins = DEFAULT_PINS.map((defaultPin) => {
    const found = existingPins.find(
      (p) => p && p.pin === defaultPin.pin
    );

    return {
      ...defaultPin,
      ...(found || {}),
      state: Boolean(found?.state),
    };
  });

  return {
    ...device,
    pins,
  };
}

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token") || ""
  );

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [relayLoading, setRelayLoading] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // SHOW MESSAGE
  // =====================================================

  function showMessage(text) {
    setMessage(text);
    setError("");
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async function login(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (!data.token) {
        throw new Error("Login successful, but token was not received");
      }

      localStorage.setItem("token", data.token);

      setToken(data.token);
      setPassword("");

      showMessage("Login successful");

    } catch (err) {
      showError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {
    localStorage.removeItem("token");

    setToken("");
    setDevices([]);
    setSelectedDevice(null);

    setEmail("");
    setPassword("");
    setMessage("");
    setError("");
  }

  // =====================================================
  // GET DEVICES
  // =====================================================

  async function loadDevices() {
    if (!token) return;

    setDeviceLoading(true);

    try {
      const res = await fetch(`${API}/api/devices`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          logout();
          return;
        }

        throw new Error(
          data.message || "Failed to load devices"
        );
      }

      const loadedDevices = Array.isArray(data.devices)
        ? data.devices.map(normalizeDevice)
        : [];

      setDevices(loadedDevices);

      setSelectedDevice((current) => {
        if (!loadedDevices.length) {
          return null;
        }

        if (current) {
          const updated = loadedDevices.find(
            (device) =>
              device.deviceId === current.deviceId
          );

          if (updated) {
            return updated;
          }
        }

        return loadedDevices[0];
      });

    } catch (err) {
      showError(
        err.message || "Failed to load devices"
      );
    } finally {
      setDeviceLoading(false);
    }
  }

  // =====================================================
  // CREATE DEVICE
  // =====================================================

  async function createDevice(e) {
    e.preventDefault();

    const deviceName = name.trim();

    if (!deviceName) {
      showError("Device name is required");
      return;
    }

    setDeviceLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`${API}/api/devices`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          name: deviceName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          logout();
          return;
        }

        throw new Error(
          data.message || "Failed to create device"
        );
      }

      const newDevice = normalizeDevice(data.device);

      setName("");

      if (newDevice) {
        setDevices((prev) => [
          newDevice,
          ...prev.filter(
            (device) =>
              device.deviceId !== newDevice.deviceId
          ),
        ]);

        setSelectedDevice(newDevice);
      } else {
        await loadDevices();
      }

      showMessage("Device created successfully");

    } catch (err) {
      showError(
        err.message || "Failed to create device"
      );
    } finally {
      setDeviceLoading(false);
    }
  }
 
  // =====================================================
  // RELAY ON / OFF
  // =====================================================

  async function toggleRelay(pin, currentState) {
    if (!selectedDevice) {
      showError("Please select a device");
      return;
    }

    if (!pin) {
      showError("Invalid relay pin");
      return;
    }

    const newState = !Boolean(currentState);

    setRelayLoading(pin);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `${API}/api/devices/${encodeURIComponent(
          selectedDevice.deviceId
        )}/pin/${encodeURIComponent(pin)}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            state: newState,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          logout();
          return;
        }

        throw new Error(
          data.message || "Relay control failed"
        );
      }

      const updatedDevice = normalizeDevice(
        data.device
      );

      if (!updatedDevice) {
        throw new Error(
          "Server did not return updated device"
        );
      }

      setSelectedDevice(updatedDevice);

      setDevices((prev) =>
        prev.map((device) =>
          device.deviceId === updatedDevice.deviceId
            ? updatedDevice
            : device
        )
      );

      showMessage(
        `${pin} ${newState ? "ON" : "OFF"}`
      );

    } catch (err) {
      showError(
        err.message || "Relay control failed"
      );
    } finally {
      setRelayLoading("");
    }
  }

  // =====================================================
  // LOAD DEVICES AFTER LOGIN
  // =====================================================

  useEffect(() => {
    if (token) {
      loadDevices();
    }
  }, [token]);

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (!token) {
    return (
      <div className="app">

        <div className="login-card">

          <h1>ESP8266 IoT</h1>

          <p>
            Login to your dashboard
          </p>

          <form onSubmit={login}>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

        </div>

      </div>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div>
          <h1>ESP8266 IoT</h1>

          <span>
            Relay Control Dashboard
          </span>
        </div>

        <button
          className="logout"
          onClick={logout}
        >
          Logout
        </button>

      </header>


      {/* MESSAGE */}

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      {/* ADD DEVICE */}

      <section className="panel">

        <h2>Add Device</h2>
 
        <form
          className="add-device"
          onSubmit={createDevice}
        >

          <input
            type="text"
            placeholder="Device name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />

          <button
            type="submit"
            disabled={deviceLoading}
          >
            {deviceLoading
              ? "Adding..."
              : "Add Device"}
          </button>

        </form>

      </section>


      {/* DEVICE SELECT */}

      {devices.length > 0 && (

        <section className="panel">

          <h2>Your Devices</h2>

          <div className="devices">

            {devices.map((device) => (

              <button
                key={device.deviceId}
                className={
                  selectedDevice?.deviceId ===
                  device.deviceId
                    ? "device selected"
                    : "device"
                }

                onClick={() =>
                  setSelectedDevice(
                    normalizeDevice(device)
                  )
                }
              >

                <strong>
                  {device.name ||
                    "ESP8266 Device"}
                </strong>

                <small>
                  {device.deviceId}
                </small>

                <small>
                  Status:{" "}
                  {device.status || "offline"}
                </small>

              </button>

            ))}

          </div>

        </section>

      )}


      {/* DEVICE LOADING */}

      {deviceLoading &&
        devices.length === 0 && (

          <section className="panel">

            <p>
              Loading devices...
            </p>

          </section>

        )}


      {/* RELAYS */}

      {selectedDevice &&
        Array.isArray(selectedDevice.pins) && (

          <section className="panel">

            <div className="device-title">

              <div>

                <h2>
                  {selectedDevice.name ||
                    "ESP8266 Device"}
                </h2>

                <p>
                  Device ID:{" "}
                  {selectedDevice.deviceId}
                </p>

              </div>

              <div
                className={
                  selectedDevice.status ===
                  "online"
                    ? "status online"
                    : "status offline"
                }
              >
                {selectedDevice.status ||
                  "offline"}
              </div>

            </div>


            <div className="relay-grid">

              {selectedDevice.pins.map(
                (pin, index) => {

                  const pinState =
                    Boolean(pin?.state);

                  const pinName =
                    pin?.pin ||
                    DEFAULT_PINS[index]?.pin ||
                    `D${index}`;

                  return (

                    <div
                      className={
                        pinState
                          ? "relay-card on"
                          : "relay-card"
                      }
                      key={pinName}
                    >

                      <div className="relay-number">
                        Relay {index + 1}
                      </div>

                      <h3>
                        {pinName}
                      </h3>

                      <div
                        className={
                          pinState
                            ? "relay-state on-text"
                            : "relay-state"
                        }
                      >
                        {pinState
                          ? "ON"
                          : "OFF"}
                      </div>

                      <button
                        className={
                          pinState
                            ? "relay-button on-button"
                            : "relay-button"
                        }

                        disabled={
                          relayLoading ===
                          pinName
                        }

                        onClick={() =>
                          toggleRelay(
                            pinName,
                            pinState
                          )
                        }
                      >
                        {relayLoading === pinName
                          ? "WAIT..."
                          : pinState
                            ? "TURN OFF"
                            : "TURN ON"}
                      </button>

                    </div>

                  );
                }
              )}

            </div>

          </section>

        )}


      {/* NO DEVICE */}

      {!deviceLoading &&
        devices.length === 0 && (

          <section className="empty">

            <h2>
              No devices found
            </h2>

            <p>
              Add your first ESP8266
              device above.
            </p>

          </section>

        )}

    </div>
  );
}

export default App;
