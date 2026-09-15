import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'https://kare-one-api.onrender.com/api').replace(/\/$/, '');

const roles = [
  { key: 'student', label: 'Student', hint: 'Register number' },
  { key: 'faculty', label: 'Faculty', hint: 'Faculty ID / email' },
  { key: 'admin', label: 'Admin', hint: 'Admin email' }
];

async function login(identity, password, role) {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password, role })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
  localStorage.setItem('kare_token', data.token);
  localStorage.setItem('kare_user', JSON.stringify(data.user));
  return data.user;
}

function Login({ onLogin }) {
  const [role, setRole] = useState('student');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(identity.trim(), password, role);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selected = roles.find((item) => item.key === role);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">K</div>
        <p className="eyebrow">KALASALINGAM ACADEMY</p>
        <h1>KARE ONE</h1>
        <p className="subtitle">SIS Smart Attendance Portal</p>

        <div className="role-tabs">
          {roles.map((item) => (
            <button key={item.key} className={role === item.key ? 'active' : ''} onClick={() => setRole(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <label>{selected.hint}</label>
          <input value={identity} onChange={(e) => setIdentity(e.target.value)} autoComplete="username" placeholder={selected.hint} required />
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Enter password" required />
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</button>
        </form>

        <p className="status-note">Phase 1 • Core authentication foundation</p>
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const menus = user.role === 'student'
    ? ['Dashboard', 'Profile', 'Attendance', 'Timetable', 'Subjects', 'Notifications', 'Leave Requests', 'History']
    : user.role === 'faculty'
      ? ['Dashboard', 'Profile', 'My Courses', 'Class Timetable', 'Start Attendance', 'Live Attendance', 'Students', 'Reports']
      : ['Dashboard', 'Users', 'Students', 'Faculty', 'Departments', 'Subjects', 'Timetable', 'Reports', 'Audit Logs'];

  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="side-brand"><span>K</span><div><strong>KARE ONE</strong><small>SIS PORTAL</small></div></div>
        <nav>{menus.map((item, index) => <button className={index === 0 ? 'selected' : ''} key={item}>{item}</button>)}</nav>
        <button className="logout" onClick={onLogout}>Sign out</button>
      </aside>
      <main className="dashboard">
        <header><div><p className="eyebrow">{user.role.toUpperCase()} PORTAL</p><h2>Welcome, {user.name}</h2></div><div className="user-chip">{user.role}</div></header>
        <section className="hero"><div><p className="eyebrow">FOUNDATION BUILD</p><h3>Your KARE ONE workspace is ready.</h3><p>We are rebuilding the system in controlled phases. Authentication is the first verified layer.</p></div></section>
        <section className="cards"><article><span>01</span><h4>Authentication</h4><p>Core sign-in and role routing</p><b>READY</b></article><article><span>02</span><h4>QR Attendance</h4><p>Next implementation phase</p><b>UP NEXT</b></article><article><span>03</span><h4>Security</h4><p>Face, GPS and anti-proxy later</p><b>PLANNED</b></article></section>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kare_user') || 'null'); } catch { return null; }
  });
  const logout = () => { localStorage.removeItem('kare_token'); localStorage.removeItem('kare_user'); setUser(null); };
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
