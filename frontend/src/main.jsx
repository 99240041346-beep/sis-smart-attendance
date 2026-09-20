import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'https://kare-one-api.onrender.com/api').replace(/\/$/, '');

const ROLE_CONFIG = {
  student: { label: 'Student', idLabel: 'Register No', placeholder: 'Enter Register No' },
  faculty: { label: 'Faculty', idLabel: 'Faculty ID', placeholder: 'Enter Faculty ID' },
  admin: { label: 'Admin', idLabel: 'Admin ID', placeholder: 'Enter Admin ID' }
};

async function api(path, options = {}) {
  const token = localStorage.getItem('kare_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function Login({ onLogin }) {
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cfg = ROLE_CONFIG[role];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password, role })
      });
      if (remember) {
        localStorage.setItem('kare_token', data.token);
        localStorage.setItem('kare_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('kare_token', data.token);
        sessionStorage.setItem('kare_user', JSON.stringify(data.user));
      }
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sis-login-page">
      <section className="sis-login-card">
        <div className="sis-logo">
          <div className="sis-logo-mark">K</div>
          <div>
            <strong>KARE</strong>
            <span>ONE</span>
          </div>
        </div>

        <h1>Login - SIS</h1>
        <p className="login-title">Student Information System - KARE</p>
        <p className="login-help">Enter your {cfg.idLabel.toLowerCase()} and password.</p>

        <div className="login-role-switch" aria-label="Portal type">
          {Object.entries(ROLE_CONFIG).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={role === key ? 'active' : ''}
              onClick={() => { setRole(key); setError(''); setIdentifier(''); }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="sis-form">
          <label>{cfg.idLabel}</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={cfg.placeholder}
            autoComplete="username"
            required
          />

          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Enter Password"
            autoComplete="current-password"
            required
          />

          <label className="remember-row">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Remember me</span>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="sis-sign-in" disabled={busy}>
            {busy ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <div className="login-footer">
          <span>© SDT-KARE</span>
          <span>KARE ONE • Smart Attendance</span>
        </div>
      </section>
    </main>
  );
}

function Profile({ user, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name || user.name || '',
    email: user.email || '',
    department: user.department || '',
    semester: user.semester || '',
    section: user.section || '',
    phone: user.phone || '',
    designation: user.designation || ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isStudent = user.role === 'student';
  const isFaculty = user.role === 'faculty';

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/profile', { method: 'PATCH', body: JSON.stringify(form) });
      const updated = data.user || { ...user, ...form, name: form.full_name };
      localStorage.setItem('kare_user', JSON.stringify(updated));
      onSaved(updated);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-card">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>{isStudent ? 'Student Profile' : isFaculty ? 'Faculty Profile' : 'Administrator Profile'}</h2>
          <p>Keep your SIS information accurate. Attendance security will use the verified profile in later phases.</p>
        </div>
        <div className="profile-avatar">{(form.full_name || 'K').charAt(0).toUpperCase()}</div>
      </div>

      <form className="profile-form" onSubmit={save}>
        <div className="section-label">Personal information</div>
        <div className="field">
          <label>Full Name</label>
          <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Add phone number" />
        </div>

        <div className="section-label">Academic / employment information</div>
        <div className="field">
          <label>{isStudent ? 'Register Number' : 'Employee ID'}</label>
          <input value={user.register_no || user.employee_id || ''} disabled />
        </div>
        <div className="field">
          <label>Department</label>
          <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
        </div>

        {isStudent && <>
          <div className="field">
            <label>Semester</label>
            <input value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} />
          </div>
          <div className="field">
            <label>Section</label>
            <input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="Example: S19" />
          </div>
        </>}

        {isFaculty && <div className="field">
          <label>Designation</label>
          <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="Example: Assistant Professor" />
        </div>}

        {user.role === 'admin' && <div className="field">
          <label>Access Level</label>
          <input value="System Administrator" disabled />
        </div>}

        {error && <div className="login-error full">{error}</div>}
        {message && <div className="save-success full">✓ {message}</div>}
        <div className="full form-actions">
          <button className="sis-sign-in compact" disabled={saving}>{saving ? 'SAVING...' : 'SAVE PROFILE'}</button>
        </div>
      </form>
    </section>
  );
}

function StudentDashboard({ stats }) {
  return (
    <>
      <div className="welcome-panel">
        <div>
          <p className="eyebrow">STUDENT INFORMATION SYSTEM</p>
          <h2>Student Dashboard</h2>
          <p>Attendance, academics and your verified student profile will appear here.</p>
        </div>
        <div className="dashboard-mark">SIS</div>
      </div>
      <div className="dashboard-grid">
        <article className="info-card"><span>Attendance</span><strong>{stats.attendance?.present || 0}</strong><small>Present records</small></article>
        <article className="info-card"><span>Total classes</span><strong>{stats.attendance?.total || 0}</strong><small>Recorded sessions</small></article>
        <article className="info-card"><span>Portal</span><strong>ACTIVE</strong><small>Student account</small></article>
      </div>
      <div className="page-card compact-card">
        <p className="eyebrow">NEXT ATTENDANCE LAYER</p>
        <h3>QR + Face + Location Verification</h3>
        <p>In the next phase, the student will scan the faculty's live QR and then pass the required face/liveness and location checks before attendance is accepted.</p>
      </div>
    </>
  );
}

function FacultyDashboard({ stats }) {
  return (
    <>
      <div className="welcome-panel">
        <div>
          <p className="eyebrow">FACULTY INFORMATION SYSTEM</p>
          <h2>Faculty Dashboard</h2>
          <p>Manage classes, attendance sessions, student verification and your faculty profile.</p>
        </div>
        <div className="dashboard-mark">FAC</div>
      </div>
      <div className="dashboard-grid">
        <article className="info-card"><span>Attendance sessions</span><strong>{stats.sessions || 0}</strong><small>Created by you</small></article>
        <article className="info-card"><span>Section control</span><strong>READY</strong><small>Faculty-controlled</small></article>
        <article className="info-card"><span>Verification</span><strong>NEXT</strong><small>Face + GPS phase</small></article>
      </div>
    </>
  );
}

function AdminDashboard({ stats }) {
  return (
    <>
      <div className="welcome-panel">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Admin Dashboard</h2>
          <p>System-level controls will be added progressively without changing the student/faculty attendance flow.</p>
        </div>
        <div className="dashboard-mark">ADM</div>
      </div>
      <div className="dashboard-grid">
        <article className="info-card"><span>Active users</span><strong>{stats.users || 0}</strong><small>System accounts</small></article>
        <article className="info-card"><span>Subjects</span><strong>API</strong><small>Management layer</small></article>
        <article className="info-card"><span>Audit</span><strong>READY</strong><small>Security foundation</small></article>
      </div>
    </>
  );
}

function QRGenerator({ subjects }) {
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('');
  const [room, setRoom] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  async function start() {
    setError('');
    try {
      const data = await api('/attendance/sessions', { method: 'POST', body: JSON.stringify({ subjectId, section, room, durationSeconds: 60 }) });
      setSession(data);
    } catch (e) { setError(e.message); }
  }

  async function close() {
    try {
      await api(`/attendance/sessions/${session.session.id}/close`, { method: 'POST' });
      setSession({ ...session, session: { ...session.session, status: 'closed' } });
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    if (session?.qrToken) QRCode.toCanvas(document.getElementById('faculty-qr'), session.qrToken, { width: 300, margin: 2 });
  }, [session]);

  return (
    <section className="page-card">
      <div className="page-heading">
        <div><p className="eyebrow">FACULTY • ATTENDANCE</p><h2>Start Attendance</h2><p>Section and room are controlled by the faculty for the live session.</p></div>
        <span className="status-pill">60 SEC QR</span>
      </div>
      {!session ? (
        <div className="attendance-start">
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <input placeholder="Section (example: S19)" value={section} onChange={e => setSection(e.target.value)} />
          <input placeholder="Room" value={room} onChange={e => setRoom(e.target.value)} />
          <button className="sis-sign-in compact" disabled={!subjectId} onClick={start}>GENERATE QR</button>
        </div>
      ) : (
        <div className="live-session">
          <div><canvas id="faculty-qr" /></div>
          <div><p className="eyebrow">LIVE SESSION</p><h3>{session.session.code || 'Attendance QR'}</h3><p>Section: <b>{session.session.section || 'All'}</b></p><p>Room: <b>{session.session.room || 'Not set'}</b></p><p>Status: <b>{session.session.status}</b></p><button className="danger-btn" onClick={close} disabled={session.session.status === 'closed'}>CLOSE SESSION</button></div>
        </div>
      )}
      {error && <div className="login-error">{error}</div>}
    </section>
  );
}

function StudentScanner() {
  const [scanner, setScanner] = useState(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function start() {
    setError('');
    setResult('');
    try {
      const instance = new Html5Qrcode('student-reader');
      setScanner(instance);
      await instance.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, async decoded => {
        try {
          const data = await api('/attendance/scan', { method: 'POST', body: JSON.stringify({ qrToken: decoded }) });
          setResult(data.message);
          await instance.stop();
        } catch (e) { setError(e.message); }
      });
    } catch (e) { setError(e.message); }
  }

  async function stop() {
    if (scanner) {
      try { await scanner.stop(); } catch {}
      setScanner(null);
    }
  }

  useEffect(() => () => { if (scanner) scanner.stop().catch(() => {}); }, [scanner]);

  return (
    <section className="page-card">
      <div className="page-heading"><div><p className="eyebrow">STUDENT • ATTENDANCE</p><h2>Scan Attendance QR</h2><p>This scanner will become the first step of the multi-factor attendance check.</p></div><span className="status-pill">QR</span></div>
      <div id="student-reader" className="scanner-box" />
      <div className="form-actions"><button className="sis-sign-in compact" onClick={start}>START CAMERA</button><button className="secondary-btn" onClick={stop}>STOP</button></div>
      {result && <div className="save-success">✓ {result}</div>}
      {error && <div className="login-error">{error}</div>}
    </section>
  );
}

function Portal({ initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [page, setPage] = useState('Dashboard');
  const [stats, setStats] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');

  const studentMenu = ['Dashboard', 'Profile', 'Attendance', 'Timetable', 'Subjects', 'Notifications', 'Leave Requests', 'History'];
  const facultyMenu = ['Dashboard', 'Profile', 'My Courses', 'Class Timetable', 'Start Attendance', 'Live Attendance', 'Students', 'Reports'];
  const adminMenu = ['Dashboard', 'Profile', 'Students', 'Faculty', 'Departments', 'Subjects', 'Timetable', 'Reports', 'Audit Logs'];
  const menu = user.role === 'student' ? studentMenu : user.role === 'faculty' ? facultyMenu : adminMenu;

  useEffect(() => {
    Promise.all([api('/dashboard'), api('/subjects')])
      .then(([dashboard, subjectData]) => { setStats(dashboard); setSubjects(subjectData.subjects || []); })
      .catch(e => setError(e.message));
  }, []);

  function logout() {
    localStorage.removeItem('kare_token');
    localStorage.removeItem('kare_user');
    sessionStorage.removeItem('kare_token');
    sessionStorage.removeItem('kare_user');
    onLogout();
  }

  function renderPage() {
    if (page === 'Profile') return <Profile user={user} onSaved={updated => setUser(updated)} />;
    if (user.role === 'student' && page === 'Attendance') return <StudentScanner />;
    if (user.role === 'faculty' && page === 'Start Attendance') return <QRGenerator subjects={subjects} />;
    if (page === 'Dashboard') {
      if (user.role === 'student') return <StudentDashboard stats={stats} />;
      if (user.role === 'faculty') return <FacultyDashboard stats={stats} />;
      return <AdminDashboard stats={stats} />;
    }
    return (
      <section className="page-card empty-page">
        <p className="eyebrow">{user.role.toUpperCase()} PORTAL</p>
        <h2>{page}</h2>
        <p>This module is intentionally being built step-by-step. The navigation is already separated by role so new modules can be added without changing the login foundation.</p>
        <div className="module-state">MODULE READY FOR PHASED BUILD</div>
      </section>
    );
  }

  return (
    <div className="sis-portal">
      <aside className="sis-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-mark">K</div>
          <div><strong>KARE ONE</strong><small>STUDENT INFORMATION SYSTEM</small></div>
        </div>
        <div className="portal-user">
          <div className="mini-avatar">{(user.full_name || user.name || 'K').charAt(0).toUpperCase()}</div>
          <div><strong>{user.full_name || user.name}</strong><span>{user.register_no || user.employee_id || user.role}</span></div>
        </div>
        <nav className="sis-nav">
          {menu.map(item => <button key={item} className={page === item ? 'selected' : ''} onClick={() => { setPage(item); setError(''); }}>{item}</button>)}
        </nav>
        <button className="sidebar-logout" onClick={logout}>Sign Out</button>
      </aside>

      <main className="sis-main">
        <header className="sis-topbar">
          <div><span>KARE ONE</span><strong>{user.role === 'student' ? 'Student Portal' : user.role === 'faculty' ? 'Faculty Portal' : 'Administration Portal'}</strong></div>
          <div className="topbar-account"><span>{user.email || ''}</span><b>{user.role.toUpperCase()}</b></div>
        </header>
        <div className="sis-content">
          {error && <div className="login-error">{error}</div>}
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kare_user') || sessionStorage.getItem('kare_user') || 'null');
    } catch { return null; }
  });
  return user ? <Portal initialUser={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
