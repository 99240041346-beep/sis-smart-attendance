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
  const token = localStorage.getItem('kare_token') || sessionStorage.getItem('kare_token');
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
  const canEdit = user.role === 'admin';
  const [form, setForm] = useState({
    full_name: user.full_name || user.name || '',
    email: user.email || '',
    department: user.department || '',
    semester: user.semester || '',
    section: user.section || '',
    phone: user.phone || '',
    designation: user.designation || ''
  });
  const [photoPreview, setPhotoPreview] = useState(user.profile_photo_url || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const data = await api('/profile', { method: 'PATCH', body: JSON.stringify({ ...form, profile_photo_url: photoPreview || null }) });
      const updated = data.user || { ...user, ...form, profile_photo_url: photoPreview || null, name: form.full_name };
      localStorage.setItem('kare_user', JSON.stringify(updated));
      onSaved(updated);
      setMessage('Administrator profile updated successfully.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const title = user.role === 'student' ? 'Student Profile' : user.role === 'faculty' ? 'Faculty Profile' : 'Administrator Profile';
  return (
    <section className="page-card">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>{title}</h2>
          <p>{canEdit ? 'Administrator account settings.' : 'Your account details are managed by the administrator. Contact the appropriate portal administrator for changes.'}</p>
        </div>
        <div className="profile-avatar-wrap">{photoPreview ? <img className="profile-avatar-image" src={photoPreview} alt="" /> : <div className="profile-avatar">{(form.full_name || 'K').charAt(0).toUpperCase()}</div>}<span className="profile-status-dot" /></div>
      </div>

      <form className="profile-form" onSubmit={save}>
        <div className="profile-overview full"><div><span>ROLE</span><b>{user.role.toUpperCase()}</b></div><div><span>STATUS</span><b className="profile-active">ACTIVE</b></div><div><span>ID</span><b>{user.register_no || user.employee_id || '—'}</b></div></div>
        <div className="section-label">Personal information</div>
        <div className="field"><label>Full Name</label><input value={form.full_name} readOnly={!canEdit} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
        <div className="field"><label>Email</label><input type="email" value={form.email} readOnly={!canEdit} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="field"><label>Phone</label><input value={form.phone} readOnly={!canEdit} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>

        <div className="section-label">Academic / employment information</div>
        <div className="field"><label>{user.role === 'student' ? 'Register Number' : 'Employee ID'}</label><input value={user.register_no || user.employee_id || ''} disabled /></div>
        <div className="field"><label>Department</label><input value={form.department} readOnly={!canEdit} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
        {user.role === 'student' && <><div className="field"><label>Semester</label><input value={form.semester} readOnly /></div><div className="field"><label>Section</label><input value={form.section} readOnly /></div></>}
        {user.role === 'faculty' && <div className="field"><label>Designation</label><input value={form.designation} readOnly /></div>}
        {user.role === 'admin' && <div className="field"><label>Access Level</label><input value="System Administrator" disabled /></div>}

        {error && <div className="login-error full">{error}</div>}
        {message && <div className="save-success full">✓ {message}</div>}
        <div className="field full profile-photo-field">
          <label>Profile photo</label>
          <input type="url" value={photoPreview} readOnly={!canEdit} onChange={e => setPhotoPreview(e.target.value)} placeholder="Optional image URL" />
        </div>
        {canEdit && <div className="full form-actions"><button className="sis-sign-in compact" disabled={saving}>{saving ? 'SAVING...' : 'SAVE PROFILE'}</button></div>}
        {!canEdit && <div className="student-security-note full">🔒 This profile is read-only. Student and faculty details can only be changed by authorized staff.</div>}
      </form>
    </section>
  );
}

function AdminFacultyManagement() {
  const empty = { full_name:'', email:'', department:'', designation:'', phone:'', profile_photo_url:'' };
  const [faculty,setFaculty]=useState([]),[editing,setEditing]=useState(null),[form,setForm]=useState(empty),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{api('/admin/faculty').then(d=>setFaculty(d.faculty||[])).catch(e=>setError(e.message));},[]);
  const edit=f=>{setEditing(f.id);setForm({full_name:f.full_name||f.name||'',email:f.email||'',department:f.department||'',designation:f.designation||'',phone:f.phone||'',profile_photo_url:f.profile_photo_url||''});setShowForm(true);setMessage('');setError('');};
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{const d=await api('/admin/faculty/'+editing,{method:'PATCH',body:JSON.stringify(form)});setFaculty(p=>p.map(x=>x.id===editing?d.faculty:x));setShowForm(false);setMessage('Faculty details updated successfully.');}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="page-card student-management">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION • FACULTY</p><h2>Faculty Details</h2><p>Faculty accounts and employment details are controlled by the administrator.</p></div></div>
    {message&&<div className="save-success">{message}</div>}{error&&<div className="login-error">{error}</div>}
    {showForm&&<form className="student-create-form" onSubmit={save}>
      <div className="student-form-title"><div><p className="eyebrow">EDIT FACULTY</p><h3>Update faculty details</h3></div><button type="button" className="secondary-btn" onClick={()=>setShowForm(false)}>CANCEL</button></div>
      <div className="student-form-grid">
        <div className="field"><label>Full Name</label><input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/></div>
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div className="field"><label>Department</label><input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></div>
        <div className="field"><label>Designation</label><input value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}/></div>
        <div className="field"><label>Phone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
        <div className="field"><label>Profile Photo URL</label><input type="url" value={form.profile_photo_url} onChange={e=>setForm({...form,profile_photo_url:e.target.value})}/></div>
      </div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy}>{busy?'SAVING...':'UPDATE FACULTY'}</button></div>
    </form>}
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Faculty</th><th>Employee ID</th><th>Department</th><th>Designation</th><th>Contact</th><th>Action</th></tr></thead><tbody>
      {faculty.map(f=><tr key={f.id}><td><div className="student-cell"><div className="student-mini-photo">{f.profile_photo_url?<img src={f.profile_photo_url} alt=""/>:(f.full_name||'F').charAt(0)}</div><div><b>{f.full_name||f.name}</b><small>{f.email||'No email'}</small></div></div></td><td><strong>{f.employee_id||'—'}</strong></td><td>{f.department||'—'}</td><td>{f.designation||'—'}</td><td>{f.phone||'—'}</td><td><button className="text-action" onClick={()=>edit(f)}>Edit</button></td></tr>)}
      {!faculty.length&&<tr><td colSpan="6" className="empty-table">No faculty accounts found.</td></tr>}
    </tbody></table></div>
  </section>;
}

function StudentDashboard({ user, stats }) {
  const attendance = stats.attendance || {};
  const attendancePct = attendance.total ? Math.round(((attendance.present || 0) / attendance.total) * 100) : 0;
  const today = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'short', year:'numeric' });

  return (
    <div className="sis-student-dashboard">
      <div className="sis-student-header">
        <div>
          <div className="sis-breadcrumb">HOME / DASHBOARD</div>
          <h2>Dashboard</h2>
          <p>Welcome to Student Information System</p>
        </div>
        <div className="sis-student-date">{today}</div>
      </div>

      <section className="sis-notice-strip">
        <div className="sis-notice-title">Notifications</div>
        <div className="sis-notice-item"><b>Student Portal</b><span>Your SIS account is active. Academic, attendance and profile information is shown below.</span></div>
        <div className="sis-notice-item"><b>Attendance</b><span>Attendance marking will use the controlled KARE ONE verification workflow.</span></div>
      </section>

      <div className="sis-dashboard-layout">
        <div className="sis-dashboard-main">
          <section className="sis-panel">
            <div className="sis-panel-title"><h3>Personal Details</h3><span>Student Information</span></div>
            <div className="sis-person-grid">
              <div><label>Register Number</label><b>{user.register_no || '—'}</b></div>
              <div><label>Name of the Student</label><b>{user.full_name || user.name || '—'}</b></div>
              <div><label>Degree / Programme</label><b>{user.department ? 'B.Tech / ' + user.department : '—'}</b></div>
              <div><label>Batch</label><b>{user.batch || '—'}</b></div>
              <div><label>Section</label><b>{user.section || '—'}</b></div>
              <div><label>Semester</label><b>{user.semester || '—'}</b></div>
              <div><label>Faculty Advisor</label><b>{user.faculty_advisor || '—'}</b></div>
              <div><label>Email</label><b>{user.email || '—'}</b></div>
              <div><label>Contact Number</label><b>{user.phone || '—'}</b></div>
              <div><label>Account Status</label><b className="sis-active-text">Active</b></div>
            </div>
          </section>

          <section className="sis-panel">
            <div className="sis-panel-title"><h3>Attendance Summary</h3><span>Current records</span></div>
            <div className="sis-stat-row">
              <div className="sis-stat-box"><span>Present</span><strong>{attendance.present || 0}</strong></div>
              <div className="sis-stat-box"><span>Total Sessions</span><strong>{attendance.total || 0}</strong></div>
              <div className="sis-stat-box"><span>Attendance %</span><strong>{attendancePct}%</strong></div>
              <div className="sis-stat-box"><span>Status</span><strong className={attendancePct < 75 && attendance.total ? 'sis-risk-text' : 'sis-active-text'}>{attendance.total ? (attendancePct < 75 ? 'LOW' : 'GOOD') : 'N/A'}</strong></div>
            </div>
          </section>

          <section className="sis-panel">
            <div className="sis-panel-title"><h3>Sessions & Circular / Notice</h3><span>Latest academic activity</span></div>
            <div className="sis-session-list">
              <div className="sis-session-row"><span className="sis-time-badge">TODAY</span><div><b>Academic Sessions</b><small>Your registered class sessions will appear here when timetable data is connected.</small></div><strong>—</strong></div>
              <div className="sis-session-row"><span className="sis-time-badge">SIS</span><div><b>Course Registration</b><small>Course registration and semester modules are available from the navigation menu.</small></div><strong>OPEN</strong></div>
              <div className="sis-session-row"><span className="sis-time-badge">INFO</span><div><b>University Circular / Notice</b><small>Official notices published for students will appear in this section.</small></div><strong>—</strong></div>
            </div>
          </section>
        </div>

        <aside className="sis-dashboard-side">
          <section className="sis-panel sis-status-card">
            <div className="sis-panel-title"><h3>Current Status</h3></div>
            <div className="sis-status-value"><span></span>ACTIVE</div>
            <p>Your student account is active in KARE SIS.</p>
          </section>
          <section className="sis-panel">
            <div className="sis-panel-title"><h3>Academic Snapshot</h3></div>
            <div className="sis-side-list">
              <div><span>Programme</span><b>{user.department || 'Not set'}</b></div>
              <div><span>Semester</span><b>{user.semester || '—'}</b></div>
              <div><span>Section</span><b>{user.section || '—'}</b></div>
              <div><span>Register No</span><b>{user.register_no || '—'}</b></div>
            </div>
          </section>
          <section className="sis-panel sis-quick-card">
            <div className="sis-panel-title"><h3>Quick Access</h3></div>
            <p>Use the left navigation for Semester, Grade, Time Table, Fees, Course Registration, Attendance and other SIS services.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StudentSisModule({ page, user, stats }) {
  const descriptions = {
    'Grievances': ['Grievances', 'Submit and track student grievances.'],
    'Semester': ['Semester', 'Semester information, registration and academic details.'],
    'Arrear Registration': ['Arrear Registration', 'View and manage eligible arrear registration information.'],
    'Course Registration': ['Course Registration', 'Registered courses and semester course registration.'],
    'OE-HSS Registration': ['OE / HSS Registration', 'Open Elective and Humanities / Social Science course registration.'],
    'Grade': ['Grade', 'Semester grades, SGPA, CGPA and course-wise results.'],
    'Seating & Time Table': ['Seating & Time Table', 'Examination seating and class timetable information.'],
    'Industrial Training TPO': ['Industrial Training TPO', 'Industrial training and placement-office related student information.'],
    'Travel History': ['Travel History', 'Student travel and campus movement records when available.'],
    'One Credit': ['One Credit', 'One-credit course registration and records.'],
    'Online / InternIT Courses': ['Online / InternIT Courses', 'Online, internship and IT course records.'],
    'NonCGPA': ['NonCGPA', 'Non-CGPA academic activities and records.'],
    'Makeup': ['Makeup', 'Make-up examination and eligible course information.'],
    'Fees': ['Fees', 'Tuition fee payment, fee due and payment history.'],
    'Exam Papers': ['Exam Papers', 'Examination papers and related academic resources.'],
    'Course Feedback': ['Course Feedback', 'Course-wise faculty feedback available to students.']
  };
  const item = descriptions[page] || [page, 'Student Information System module.'];
  return (
    <section className="sis-panel sis-module-page">
      <div className="sis-breadcrumb">HOME / {item[0].toUpperCase()}</div>
      <div className="sis-module-heading"><div><h2>{item[0]}</h2><p>{item[1]}</p></div><span className="sis-module-badge">SIS</span></div>
      <div className="sis-module-grid">
        <div className="sis-detail-card"><span>Student</span><b>{user.full_name || user.name || '—'}</b></div>
        <div className="sis-detail-card"><span>Register Number</span><b>{user.register_no || '—'}</b></div>
        <div className="sis-detail-card"><span>Programme</span><b>{user.department || '—'}</b></div>
        <div className="sis-detail-card"><span>Semester / Section</span><b>{user.semester || '—'} / {user.section || '—'}</b></div>
      </div>
      <div className="sis-empty-state">
        <strong>{item[0]} data</strong>
        <p>This screen is now structured as an SIS module. Live records will be connected to the KARE ONE backend as each academic service is implemented.</p>
      </div>
    </section>
  );
}

function FacultyDashboard({ user, stats, onNavigate, facultyStudents }) {
  const firstName = (user.full_name || user.name || 'Faculty').split(' ')[0];
  return (
    <>
      <div className="faculty-hero">
        <div className="faculty-hero-main">
          <div className="faculty-avatar-large">{(user.full_name || 'F').charAt(0).toUpperCase()}</div>
          <div>
            <p className="eyebrow">FACULTY INFORMATION SYSTEM</p>
            <h2>Welcome, {firstName}</h2>
            <p>{user.designation || 'Faculty'} • {user.department || 'Department not set'}</p>
            <div className="faculty-meta">
              <span><b>Employee ID</b>{user.employee_id || 'FAC001'}</span>
              <span><b>Email</b>{user.email || 'faculty@kare.edu'}</span>
            </div>
          </div>
        </div>
        <div className="faculty-hero-actions">
          <button className="sis-sign-in compact" onClick={() => onNavigate('Start Attendance')}>START ATTENDANCE</button>
          <button className="secondary-btn" onClick={() => onNavigate('Profile')}>VIEW PROFILE</button>
        </div>
      </div>

      <div className="faculty-stat-grid">
        <article className="faculty-stat-card"><span>Attendance Sessions</span><strong>{stats.sessions || 0}</strong><small>Sessions created by you</small></article>
        <article className="faculty-stat-card"><span>Today's Classes</span><strong>0</strong><small>Timetable module next</small></article>
        <article className="faculty-stat-card"><span>Students</span><strong>{facultyStudents.length}</strong><small>Managed student accounts</small></article>
        <article className="faculty-stat-card"><span>Account</span><strong>ACTIVE</strong><small>Faculty access enabled</small></article>
      </div>

      <div className="faculty-dashboard-columns">
        <section className="page-card faculty-panel">
          <div className="panel-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h3>Faculty workspace</h3></div></div>
          <div className="faculty-action-grid">
            <button onClick={() => onNavigate('Start Attendance')}><span>01</span><b>Start Attendance</b><small>Create a controlled live QR session</small></button>
            <button onClick={() => onNavigate('Live Attendance')}><span>02</span><b>Live Attendance</b><small>Monitor students marking attendance</small></button>
            <button onClick={() => onNavigate('Students')}><span>03</span><b>Students</b><small>Manage section student verification</small></button>
            <button onClick={() => onNavigate('Reports')}><span>04</span><b>Reports</b><small>Attendance and class reports</small></button>
          </div>
        </section>

        <section className="page-card faculty-panel">
          <div className="panel-heading"><div><p className="eyebrow">FACULTY PROFILE</p><h3>Account summary</h3></div><button className="text-action" onClick={() => onNavigate('Profile')}>View profile</button></div>
          <div className="profile-summary-list">
            <div><span>Name</span><b>{user.full_name || user.name || '—'}</b></div>
            <div><span>Designation</span><b>{user.designation || 'Assistant Professor'}</b></div>
            <div><span>Department</span><b>{user.department || '—'}</b></div>
            <div><span>Phone</span><b>{user.phone || 'Not added'}</b></div>
          </div>
        </section>
      </div>

      <section className="page-card faculty-panel">
        <div className="panel-heading"><div><p className="eyebrow">ATTENDANCE WORKFLOW</p><h3>Faculty-controlled verification</h3></div><span className="status-pill">PHASED BUILD</span></div>
        <div className="workflow-steps">
          <div className="workflow-step active"><span>1</span><b>Select subject & section</b><small>Faculty controls the class scope.</small></div>
          <div className="workflow-step"><span>2</span><b>Generate live QR</b><small>Short-lived attendance token.</small></div>
          <div className="workflow-step"><span>3</span><b>Verify student</b><small>QR → face/liveness → location.</small></div>
          <div className="workflow-step"><span>4</span><b>Review attendance</b><small>Live records and reports.</small></div>
        </div>
      </section>
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

function StudentManagement() {
  const empty={register_no:'',password:'',full_name:'',email:'',department:'Computer Science and Engineering',semester:'',section:'',phone:'',profile_photo_url:''};
  const [students,setStudents]=useState([]),[form,setForm]=useState(empty),[editing,setEditing]=useState(null),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState('');
  async function load(){try{const data=await api('/faculty/students');setStudents(data.students||[]);}catch(e){setError(e.message);}} useEffect(()=>{load();},[]);
  const change=(k,v)=>setForm(p=>({...p,[k]:v}));
  const reset=()=>{setForm(empty);setEditing(null);setShowForm(false)};
  function edit(st){setEditing(st.id);setForm({register_no:st.register_no||'',password:'',full_name:st.full_name||st.name||'',email:st.email||'',department:st.department||'',semester:st.semester||'',section:st.section||'',phone:st.phone||'',profile_photo_url:st.profile_photo_url||''});setShowForm(true);setMessage('');setError('');}
  function readPhoto(file){if(!file)return;if(!file.type.startsWith('image/')){setError('Please choose an image file.');return}if(file.size>500*1024){setError('Photo must be 500 KB or smaller.');return}const r=new FileReader();r.onload=()=>change('profile_photo_url',r.result);r.onerror=()=>setError('Unable to read the photo.');r.readAsDataURL(file)}
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{if(editing){const d=await api('/faculty/students/'+editing,{method:'PATCH',body:JSON.stringify({full_name:form.full_name,email:form.email,department:form.department,semester:form.semester,section:form.section,phone:form.phone,profile_photo_url:form.profile_photo_url||null})});setStudents(p=>p.map(x=>x.id===editing?d.student:x));setMessage('Student details updated successfully.')}else{const d=await api('/faculty/students',{method:'POST',body:JSON.stringify(form)});setStudents(p=>[d.student,...p]);setMessage('Student account created. Login ID: '+d.student.register_no)}setForm(empty);setEditing(null);setShowForm(false)}catch(e){setError(e.message)}finally{setBusy(false)}}
  const filtered=students.filter(st=>{const q=search.trim().toLowerCase();if(!q)return true;return [st.register_no,st.full_name,st.name,st.email,st.section,st.department].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))});
  return <section className="page-card student-management"><div className="page-heading"><div><p className="eyebrow">FACULTY • STUDENT MANAGEMENT</p><h2>Students & Login Accounts</h2><p>Create a real student SIS account, maintain academic details, and attach the student's verification photo.</p></div><button className="sis-sign-in compact" onClick={()=>{setShowForm(true);setEditing(null);setForm(empty);setMessage('');setError('')}}>+ ADD STUDENT</button></div>
    {message&&<div className="save-success">{message}</div>}{error&&<div className="login-error">{error}</div>}
    {showForm&&<form className="student-create-form" onSubmit={save}><div className="student-form-title"><div><p className="eyebrow">{editing?'EDIT ACCOUNT':'NEW ACCOUNT'}</p><h3>{editing?'Update student':'Create student login'}</h3></div><button type="button" className="secondary-btn" onClick={reset}>CANCEL</button></div>
      <div className="student-photo-editor"><div className="student-photo-preview">{form.profile_photo_url?<img src={form.profile_photo_url} alt="Student preview"/>:<span>{(form.full_name||'S').charAt(0).toUpperCase()}</span>}</div><div><label className="photo-upload-label">Student photo</label><input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/><small>Clear front-facing photo. Maximum 500 KB. Saved with the student verification profile.</small></div></div>
      <div className="student-form-grid"><div className="field"><label>Register Number</label><input value={form.register_no} disabled={!!editing} onChange={e=>change('register_no',e.target.value)} placeholder="Example: 23CSE001" required/></div>{!editing&&<div className="field"><label>Initial Password</label><input type="password" value={form.password} onChange={e=>change('password',e.target.value)} placeholder="Minimum 4 characters" minLength="4" required/></div>}<div className="field"><label>Full Name</label><input value={form.full_name} onChange={e=>change('full_name',e.target.value)} required/></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>change('email',e.target.value)}/></div><div className="field"><label>Department</label><input value={form.department} onChange={e=>change('department',e.target.value)}/></div><div className="field"><label>Semester</label><input value={form.semester} onChange={e=>change('semester',e.target.value)} placeholder="Example: 5"/></div><div className="field"><label>Section</label><input value={form.section} onChange={e=>change('section',e.target.value)} placeholder="Example: S19"/></div><div className="field"><label>Phone</label><input value={form.phone} onChange={e=>change('phone',e.target.value)}/></div></div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy}>{busy?'SAVING...':editing?'UPDATE STUDENT':'CREATE STUDENT LOGIN'}</button></div>{!editing&&<div className="student-security-note">The student can immediately sign in using the register number and password you create. Passwords are hashed in the real database and never returned in the student list.</div>}</form>}
    <div className="student-list-toolbar"><div><b>{students.length}</b> student account{students.length===1?'':'s'}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search register no, name, section..."/></div>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Register No</th><th>Academic</th><th>Contact</th><th>Photo</th><th>Action</th></tr></thead><tbody>{filtered.map(st=><tr key={st.id}><td><div className="student-cell"><div className="student-mini-photo">{st.profile_photo_url?<img src={st.profile_photo_url} alt=""/>:(st.full_name||'S').charAt(0)}</div><div><b>{st.full_name||st.name}</b><small>{st.email||'No email'}</small></div></div></td><td><strong>{st.register_no}</strong></td><td><span>{st.department||'—'}</span><small>Sem {st.semester||'—'} • {st.section||'No section'}</small></td><td>{st.phone||'—'}</td><td><span className={st.profile_photo_url?'photo-status yes':'photo-status'}>{st.profile_photo_url?'VERIFIED PHOTO':'NO PHOTO'}</span></td><td><button className="text-action" onClick={()=>edit(st)}>Edit</button></td></tr>)}{!filtered.length&&<tr><td colSpan="6" className="empty-table">No students found. Create the first student account.</td></tr>}</tbody></table></div>
  </section>
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
  const [facultyStudents, setFacultyStudents] = useState([]);
  const [error, setError] = useState('');

  const studentMenu = ['Dashboard', 'Grievances', 'Semester', 'Arrear Registration', 'Course Registration', 'OE-HSS Registration', 'Grade', 'Seating & Time Table', 'Industrial Training TPO', 'Travel History', 'One Credit', 'Online / InternIT Courses', 'NonCGPA', 'Makeup', 'Fees', 'Exam Papers', 'Course Feedback', 'Profile'];
  const facultyMenu = ['Dashboard', 'Profile', 'My Courses', 'Class Timetable', 'Start Attendance', 'Live Attendance', 'Students', 'Reports'];
  const adminMenu = ['Dashboard', 'Profile', 'Students', 'Faculty', 'Departments', 'Subjects', 'Timetable', 'Reports', 'Audit Logs'];
  const menu = user.role === 'student' ? studentMenu : user.role === 'faculty' ? facultyMenu : adminMenu;

  useEffect(() => {
    Promise.all([api('/dashboard'), api('/subjects'), user.role === 'faculty' ? api('/faculty/students') : Promise.resolve({ students: [] })])
      .then(([dashboard, subjectData, studentData]) => { setStats(dashboard); setSubjects(subjectData.subjects || []); setFacultyStudents(studentData.students || []); })
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
    if (user.role === 'student' && page !== 'Dashboard') return <StudentSisModule page={page} user={user} stats={stats} />;
    if (user.role === 'admin' && page === 'Faculty') return <AdminFacultyManagement />;
    if (user.role === 'student' && page === 'Attendance') return <StudentScanner />;
    if (user.role === 'faculty' && page === 'Start Attendance') return <QRGenerator subjects={subjects} />;
    if (user.role === 'faculty' && page === 'Students') return <StudentManagement />;
    if (page === 'Dashboard') {
      if (user.role === 'student') return <StudentDashboard user={user} stats={stats} />;
      if (user.role === 'faculty') return <FacultyDashboard user={user} stats={stats} onNavigate={setPage} facultyStudents={facultyStudents} />;
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
