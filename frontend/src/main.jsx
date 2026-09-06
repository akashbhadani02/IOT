import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault(); setError("");
    try {
      if (register) await api("/api/auth/register", {method:"POST", body:JSON.stringify(form)});
      const data = await api("/api/auth/login", {method:"POST", body:JSON.stringify({email:form.email,password:form.password})});
      localStorage.setItem("token", data.token); localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) { setError(e.message); }
  }

  return <div className="auth"><form onSubmit={submit} className="card auth-card">
    <h1>⚡ ESP8266 IoT</h1><p className="muted">{register ? "Create account" : "Sign in to dashboard"}</p>
    {register && <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />}
    <input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
    <input type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
    {error && <div className="error">{error}</div>}
    <button>{register ? "Create account" : "Login"}</button>
    <button type="button" className="secondary" onClick={()=>setRegister(!register)}>{register ? "Already have account?" : "Create new account"}</button>
  </form></div>;
}

function Dashboard({ user, logout }) {
  const [devices, setDevices] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { setDevices((await api("/api/devices",{headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}})).devices); }
    catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[]);

  async function addDevice(e) {
    e.preventDefault();
    try {
      await api("/api/devices",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({name})});
      setName(""); load();
    } catch(e){setError(e.message)}
  }

  return <div className="page">
    <header><div><strong>⚡ ESP8266 IoT</strong><span className="muted">Dashboard</span></div><div>{user.name} <button className="small" onClick={logout}>Logout</button></div></header>
    <main>
      <div className="top"><div><h2>My Devices</h2><p className="muted">Manage your ESP8266 devices</p></div>
      <form onSubmit={addDevice} className="add"><input placeholder="Device name" value={name} onChange={e=>setName(e.target.value)} required/><button>Add Device</button></form></div>
      {error && <div className="error">{error}</div>}
      {devices.length===0 ? <div className="card empty">No devices yet. Add your first ESP8266.</div> :
      <div className="grid">{devices.map(d=><div className="card device" key={d._id}>
        <div className="device-head"><div><h3>{d.name}</h3><span className="muted">{d.deviceId}</span></div><span className="status">● {d.status}</span></div>
        <div className="pins">{d.pins.map(p=><div className="pin" key={p.pin}><span>{p.name}<small>{p.pin}</small></span><button className={p.state?"on":""}>{p.state?"ON":"OFF"}</button></div>)}</div>
        <details><summary>Device token</summary><code>{d.token}</code></details>
      </div>)}</div>}
    </main>
  </div>;
}

function App() {
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem("user")||"null"));
  if (!user) return <Auth onLogin={setUser}/>;
  return <Dashboard user={user} logout={()=>{localStorage.clear();setUser(null)}}/>;
}
createRoot(document.getElementById("root")).render(<App/>);
