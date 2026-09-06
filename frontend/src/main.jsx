import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

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
  const [message, setMessage] = useState("");

  // =====================================================
  // LOGIN
  // =====================================================

  async function login(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);

      setToken(data.token);
      setMessage("Login successful");

    } catch (error) {
      setMessage(error.message);
    }

    setLoading(false);
  }


  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {
    localStorage.removeItem("token");

    setToken("");
    setDevices([]);
    setSelectedDevice(null);
  }


  // =====================================================
  // GET DEVICES
  // =====================================================

  async function loadDevices() {
    try {
      const res = await fetch(`${API}/api/devices`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load devices");
      }

      setDevices(data.devices || []);

      if (!selectedDevice && data.devices?.length > 0) {
        setSelectedDevice(data.devices[0]);
      }

    } catch (error) {
      setMessage(error.message);
    }
  }


  // =====================================================
  // CREATE DEVICE
  // =====================================================

  async function createDevice(e) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("Device name required");
      return;
    }

    try {
      const res = await fetch(`${API}/api/devices`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          name
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create device");
      }

      setName("");

      setMessage("Device created successfully");

      await loadDevices();

    } catch (error) {
      setMessage(error.message);
    }
  }


  // =====================================================
  // RELAY ON / OFF
  // =====================================================

  async function toggleRelay(pin, currentState) {

    if (!selectedDevice) {
      setMessage("Please select a device");
      return;
    }

    const newState = !currentState;

    try {

      const res = await fetch(
        `${API}/api/devices/${selectedDevice.deviceId}/pin/${pin}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${token}`
          },

          body: JSON.stringify({
            state: newState
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Relay control failed"
        );
      }

      // Update selected device
      setSelectedDevice(data.device);

      // Update device list
      setDevices(prev =>
        prev.map(device =>
          device.deviceId === data.device.deviceId
            ? data.device
            : device
        )
      );

      setMessage(
        `${pin} ${newState ? "ON" : "OFF"}`
      );

    } catch (error) {
      setMessage(error.message);
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

          <p>Login to your dashboard</p>

          <form onSubmit={login}>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
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
          <span>Relay Control Dashboard</span>
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
            onChange={e => setName(e.target.value)}
          />

          <button type="submit">
            Add Device
          </button>

        </form>

      </section>


      {/* DEVICE SELECT */}

      {devices.length > 0 && (

        <section className="panel">

          <h2>Your Devices</h2>

          <div className="devices">

            {devices.map(device => (

              <button
                key={device.deviceId}
                className={
                  selectedDevice?.deviceId === device.deviceId
                    ? "device selected"
                    : "device"
                }

                onClick={() =>
                  setSelectedDevice(device)
                }
              >

                <strong>
                  {device.name}
                </strong>

                <small>
                  {device.deviceId}
                </small>

                <small>
                  Status: {device.status || "offline"}
                </small>

              </button>

            ))}

          </div>

        </section>

      )}


      {/* RELAYS */}

      {selectedDevice && (

        <section className="panel">

          <div className="device-title">

            <div>
              <h2>
                {selectedDevice.name}
              </h2>

              <p>
                Device ID: {selectedDevice.deviceId}
              </p>
            </div>

            <div
              className={
                selectedDevice.status === "online"
                  ? "status online"
                  : "status offline"
              }
            >
              {selectedDevice.status || "offline"}
            </div>

          </div>


          <div className="relay-grid">

            {selectedDevice.pins.map((pin, index) => (

              <div
                className={
                  pin.state
                    ? "relay-card on"
                    : "relay-card"
                }

                key={pin.pin}
              >

                <div className="relay-number">
                  Relay {index + 1}
                </div>

                <h3>
                  {pin.pin}
                </h3>

                <div
                  className={
                    pin.state
                      ? "relay-state on-text"
                      : "relay-state"
                  }
                >
                  {pin.state ? "ON" : "OFF"}
                </div>

                <button
                  className={
                    pin.state
                      ? "relay-button on-button"
                      : "relay-button"
                  }

                  onClick={() =>
                    toggleRelay(
                      pin.pin,
                      pin.state
                    )
                  }
                >
                  {pin.state ? "TURN OFF" : "TURN ON"}
                </button>

              </div>

            ))}

          </div>

        </section>

      )}


      {/* NO DEVICE */}

      {devices.length === 0 && (

        <section className="empty">

          <h2>No devices found</h2>

          <p>
            Add your first ESP8266 device above.
          </p>

        </section>

      )}

    </div>
  );
}

export default App;