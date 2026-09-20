import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import './style.css';
import AdminStudentManagement from './AdminStudentManagement';
import AdminFacultyFIS from './AdminFacultyManagement';
import TeachingAssignments from './TeachingAssignments';

const API = (import.meta.env.VITE_API_URL || 'https://kare-one-api.onrender.com/api').replace(/\/$/, '');

const ROLE_CONFIG = {
  student: { label: 'Student', idLabel: 'Register No', placeholder: 'Enter Register No' },
  faculty: { label: 'Faculty', idLabel: 'Faculty ID', placeholder: 'Enter Faculty ID' },
  admin: { label: 'Admin', idLabel: 'Admin ID', placeholder: 'Enter Admin ID' }
};

async function api(path, options = {}) {
  const token = localStorage.getItem('kare_token') || sessionStorage.getItem('kare_token');
  const request = async () => {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  try { return await request(); }
  catch (err) {
    if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      try { return await request(); } catch (_retryErr) {}
      throw new Error('KARE API is temporarily unreachable. Please refresh once and try again.');
    }
    throw err;
  }
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
  const empty = { employee_id:'', password:'', full_name:'', email:'', department:'', designation:'', phone:'', profile_photo_url:'' };
  const [faculty,setFaculty]=useState([]),[editing,setEditing]=useState(null),[form,setForm]=useState(empty),[showForm,setShowForm]=useState(false),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{api('/admin/faculty').then(d=>setFaculty(d.faculty||[])).catch(e=>setError(e.message));},[]);
  const edit=f=>{setEditing(f.id);setCreating(false);setForm({employee_id:f.employee_id||'',password:'',full_name:f.full_name||f.name||'',email:f.email||'',department:f.department||'',designation:f.designation||'',phone:f.phone||'',profile_photo_url:f.profile_photo_url||''});setShowForm(true);setMessage('');setError('');};
  const openCreate=()=>{setEditing(null);setCreating(true);setForm(empty);setShowForm(true);setMessage('');setError('');};
  async function create(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{const d=await api('/admin/faculty',{method:'POST',body:JSON.stringify(form)});setFaculty(p=>[...p,d.faculty]);setForm(empty);setShowForm(false);setCreating(false);setMessage('Faculty account created successfully.');}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{const d=await api('/admin/faculty/'+editing,{method:'PATCH',body:JSON.stringify(form)});setFaculty(p=>p.map(x=>x.id===editing?d.faculty:x));setShowForm(false);setMessage('Faculty details updated successfully.');}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="page-card student-management">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION • FACULTY</p><h2>Faculty Accounts</h2><p>One administrator controls and creates all faculty accounts.</p></div><button className="sis-sign-in compact" onClick={openCreate}>+ CREATE FACULTY</button></div>
    {message&&<div className="save-success">{message}</div>}{error&&<div className="login-error">{error}</div>}
    {showForm&&<form className="student-create-form" onSubmit={creating?create:save}>
      <div className="student-form-title"><div><p className="eyebrow">{creating?'CREATE FACULTY':'EDIT FACULTY'}</p><h3>{creating?'Create faculty account':'Update faculty details'}</h3></div><button type="button" className="secondary-btn" onClick={()=>setShowForm(false)}>CANCEL</button></div>
      <div className="student-form-grid">
        <div className="field"><label>Employee ID</label><input value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})} disabled={!creating} required={creating}/></div>
        {creating&&<div className="field"><label>Initial Password</label><input type="password" minLength="4" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></div>}
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

function StudentDashboard({ user, stats, onNavigate }) {
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
            <p>Use the left navigation for Semester, Grade, Time Table, Fees, Course Registration, Attendance and other SIS services.</p><button type="button" className="sis-quick-attendance" onClick={() => onNavigate('Attendance')}>MARK ATTENDANCE</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StudentSisModule({ page, user, stats }) {
  const resourceMap = {
    'Grievances': 'grievances',
    'Grade': 'grades',
    'Seating & Time Table': 'timetable',
    'Fees': 'fees',
    'Notifications': 'notifications',
    'Course Registration': 'registrations',
    'Semester': 'semester'
  };
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [form,setForm]=useState({category:'Academic',subject:'',description:''});

  useEffect(()=>{
    let cancelled=false;
    setLoading(true); setError(''); setMessage('');
    const resource=resourceMap[page];
    const path=resource ? '/sis/student/'+resource : '/sis/student/overview';
    api(path).then(d=>{
      if(cancelled) return;
      if(resource) setRows(d.rows||[]);
      else setRows([]);
    }).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[page]);

  async function submitGrievance(e){
    e.preventDefault(); setError(''); setMessage('');
    try{
      await api('/sis/student/grievances',{method:'POST',body:JSON.stringify(form)});
      setForm({category:'Academic',subject:'',description:''});
      setMessage('Grievance submitted successfully.');
      const d=await api('/sis/student/grievances'); setRows(d.rows||[]);
    }catch(e){setError(e.message)}
  }

  const titles = {
    'Grievances':['Grievances','Submit and track student grievances.'],
    'Semester':['Semester','Semester and academic registration information.'],
    'Arrear Registration':['Arrear Registration','Arrear registration and eligibility workspace.'],
    'Course Registration':['Course Registration','Registered courses and semester registration workspace.'],
    'OE-HSS Registration':['OE / HSS Registration','Open Elective and HSS registration workspace.'],
    'Grade':['Grade','Published semester grades and grade points.'],
    'Seating & Time Table':['Seating & Time Table','Class timetable and examination seating information.'],
    'Industrial Training TPO':['Industrial Training TPO','Industrial training and TPO information.'],
    'Travel History':['Travel History','Student travel history when records are available.'],
    'One Credit':['One Credit','One-credit course records.'],
    'Online / InternIT Courses':['Online / InternIT Courses','Online, internship and IT course records.'],
    'NonCGPA':['NonCGPA','Non-CGPA academic activity records.'],
    'Makeup':['Makeup','Make-up examination records.'],
    'Fees':['Fees','Fee accounts, dues and payment status.'],
    'Exam Papers':['Exam Papers','Examination paper resources.'],
    'Course Feedback':['Course Feedback','Course-wise feedback workspace.']
  };
  const item=titles[page]||[page,'Student Information System module.'];
  const resource=resourceMap[page];

  function cell(v){
    if(v===null||v===undefined||v==='') return '—';
    if(typeof v==='object') return JSON.stringify(v);
    return String(v);
  }

  return <section className="sis-panel sis-module-page">
    <div className="sis-breadcrumb">HOME / {item[0].toUpperCase()}</div>
    <div className="sis-module-heading"><div><h2>{item[0]}</h2><p>{item[1]}</p></div><span className="sis-module-badge">SIS</span></div>
    <div className="sis-module-grid">
      <div className="sis-detail-card"><span>Student</span><b>{user.full_name||user.name||'—'}</b></div>
      <div className="sis-detail-card"><span>Register Number</span><b>{user.register_no||'—'}</b></div>
      <div className="sis-detail-card"><span>Programme</span><b>{user.department||'—'}</b></div>
      <div className="sis-detail-card"><span>Semester / Section</span><b>{user.semester||'—'} / {user.section||'—'}</b></div>
    </div>
    {error&&<div className="login-error">{error}</div>}
    {message&&<div className="save-success">✓ {message}</div>}
    {page==='Grievances'&&<form className="student-create-form" onSubmit={submitGrievance}>
      <div className="student-form-title"><div><p className="eyebrow">STUDENT SERVICE</p><h3>Submit Grievance</h3></div></div>
      <div className="student-form-grid">
        <div className="field"><label>Category</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Academic</option><option>Examination</option><option>Attendance</option><option>Fees</option><option>Hostel</option><option>Transport</option><option>Other</option></select></div>
        <div className="field"><label>Subject</label><input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} required/></div>
        <div className="field full"><label>Description</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="4" required/></div>
      </div>
      <div className="form-actions"><button className="sis-sign-in compact">SUBMIT GRIEVANCE</button></div>
    </form>}
    {loading?<div className="workspace-loading">Loading SIS records...</div>:
      resource&&rows.length>0?
      <div className="data-table-wrap"><table className="data-table"><thead><tr>{Object.keys(rows[0]).slice(0,8).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{Object.keys(rows[0]).slice(0,8).map(k=><td key={k}>{cell(r[k])}</td>)}</tr>)}</tbody></table></div>:
      resource?
      <div className="sis-empty-state"><strong>No {item[0]} records yet</strong><p>The module is connected to the SIS database. Records will appear here as the corresponding academic/service data is entered.</p></div>:
      <div className="sis-empty-state"><strong>{item[0]} workspace ready</strong><p>This module is connected to the SIS portal structure. Its dedicated transaction workflow will use the same student account, academic context and permissions.</p></div>}
  </section>;
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
  const counts=stats.counts||{};
  const recent=stats.recentAudit||[];
  return <>
    <div className="welcome-panel">
      <div><p className="eyebrow">ADMINISTRATION • SIS</p><h2>Administration Dashboard</h2><p>Central control for student, faculty, academic, attendance and security data.</p></div>
      <div className="dashboard-mark">ADM</div>
    </div>
    <div className="dashboard-grid">
      <article className="info-card"><span>Students</span><strong>{counts.students||0}</strong><small>Active student accounts</small></article>
      <article className="info-card"><span>Faculty</span><strong>{counts.faculty||0}</strong><small>Active faculty accounts</small></article>
      <article className="info-card"><span>Subjects</span><strong>{counts.subjects||0}</strong><small>Academic master data</small></article>
      <article className="info-card"><span>Departments</span><strong>{counts.departments||0}</strong><small>Organization master data</small></article>
    </div>
    <section className="page-card faculty-panel">
      <div className="panel-heading"><div><p className="eyebrow">SYSTEM ACTIVITY</p><h3>Recent administrative events</h3></div><span className="status-pill">LIVE DATA</span></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>
        {recent.slice(0,8).map((r,i)=><tr key={r.id||i}><td>{r.created_at?new Date(r.created_at).toLocaleString('en-IN'):'—'}</td><td>{r.actor||'System'}</td><td><b>{r.action||'—'}</b></td><td>{r.entity_type||'—'}</td></tr>)}
        {!recent.length&&<tr><td colSpan="4" className="empty-table">No recent audit activity.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
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

function FacultyAttendancePage({ subjects=[] }) {
  const [form,setForm]=useState({offering_id:'',section:'',room:'',latitude:'',longitude:'',allowed_radius_meters:'100',qr_expires_minutes:'5'});
  const [session,setSession]=useState(null),[qr,setQr]=useState(''),[qrImage,setQrImage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[semester,setSemester]=useState('');
  const offerings=Array.isArray(subjects)?subjects:[];
  const semesters=[...new Set(offerings.map(s=>String(s.semester||'')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const filteredOfferings=offerings.filter(s=>!semester||String(s.semester)===semester);
  const selected=offerings.find(s=>String(s.offering_id||s.id)===String(form.offering_id));

  function chooseOffering(id){
    const item=offerings.find(s=>String(s.offering_id||s.id)===String(id));
    setForm(x=>({...x,offering_id:id,section:item?.section||'',room:item?.room||''}));
  }
  async function useLocation(){
    setError('');
    if(!navigator.geolocation)return setError('Geolocation is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(p=>setForm(x=>({...x,latitude:p.coords.latitude.toFixed(7),longitude:p.coords.longitude.toFixed(7)})),e=>setError(e.message),{enableHighAccuracy:true,timeout:10000});
  }
  async function start(){
    setBusy(true);setError('');
    try{
      if(!selected)throw new Error('Select one of your assigned semester course offerings.');
      const d=await api('/sis/faculty/attendance/sessions',{method:'POST',body:JSON.stringify({
        subjectId:form.offering_id,
        section:form.section,
        room:form.room,
        allowed_radius_meters:Number(form.allowed_radius_meters),
        qr_expires_minutes:Number(form.qr_expires_minutes)
      })});
      setSession(d.session);setQr(d.qrToken||d.session.qr_token||'');setQrImage(await QRCode.toDataURL(d.qrToken||d.session.qr_token||'',{width:240,margin:2}));
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function close(){
    if(!session)return;
    try{await api('/attendance/sessions/'+session.id+'/close',{method:'POST'});setSession(null);setQr('');setQrImage('');}catch(e){setError(e.message)}
  }
  return <section className="page-card data-workspace">
    <div className="page-heading"><div><p className="eyebrow">FACULTY • ATTENDANCE</p><h2>Start Controlled Attendance</h2><p>Choose the semester and exact course offering. Attendance is permanently tied to the selected semester, section and academic year.</p></div><span className="status-pill">{session?'LIVE':'READY'}</span></div>
    {error&&<div className="login-error">{error}</div>}
    {!session?<>
      <div className="master-data-banner"><strong>Faculty workload</strong><span>Semester → Subject → Section → Academic Year</span><small>Changing semester only changes the visible assignments. Previous attendance is never deleted.</small></div>
      <div className="attendance-start-grid">
        <div className="field"><label>Semester</label><select value={semester} onChange={e=>{setSemester(e.target.value);setForm(x=>({...x,offering_id:'',section:'',room:''}))}}><option value="">All assigned semesters</option>{semesters.map(n=><option key={n} value={n}>Semester {n}</option>)}</select></div>
        <div className="field"><label>Assigned Subject / Section</label><select value={form.offering_id} onChange={e=>chooseOffering(e.target.value)}><option value="">Select assigned course</option>{filteredOfferings.map(s=><option key={s.offering_id||s.id} value={s.offering_id||s.id}>{s.code} — {s.name} • Sem {s.semester} • {s.section||'All'} • {s.academic_year||'Current'}</option>)}</select></div>
        <div className="field"><label>Section</label><input value={form.section} readOnly placeholder="Auto from assignment"/></div>
        <div className="field"><label>Academic Year</label><input value={selected?.academic_year||''} readOnly placeholder="Auto from assignment"/></div>
        <div className="field"><label>Room</label><input value={form.room} onChange={e=>setForm({...form,room:e.target.value})} placeholder="Block / Room"/></div>
        <div className="field"><label>Allowed radius (meters)</label><input type="number" min="10" value={form.allowed_radius_meters} onChange={e=>setForm({...form,allowed_radius_meters:e.target.value})}/></div>
        <div className="field"><label>QR validity (minutes)</label><input type="number" min="1" max="30" value={form.qr_expires_minutes} onChange={e=>setForm({...form,qr_expires_minutes:e.target.value})}/></div>
        <div className="field"><label>Latitude</label><input value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})} placeholder="Faculty location"/></div>
        <div className="field"><label>Longitude</label><input value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})} placeholder="Faculty location"/></div>
        <div className="field location-action"><label>Location</label><button type="button" className="secondary-btn" onClick={useLocation}>USE MY CURRENT LOCATION</button></div>
      </div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy||!selected} onClick={start}>{busy?'STARTING...':'START ATTENDANCE'}</button></div>
    </>:<div className="attendance-live-panel">
      <div><span className="live-dot">LIVE</span><h3>{session.subject_code||'Attendance Session'}</h3><p>Semester <b>{session.semester||'—'}</b> • Section <b>{session.section||'All'}</b> • Academic Year <b>{session.academic_year||'—'}</b> • Radius <b>{session.allowed_radius_meters} m</b></p><p>Room <b>{session.room||'Not set'}</b> • Expires <b>{session.qr_expires_at?new Date(session.qr_expires_at).toLocaleTimeString('en-IN'):'—'}</b></p></div>
      <div className="attendance-qr">{qrImage?<img src={qrImage} alt="Attendance QR"/>:<b>QR unavailable</b>}</div>
      <p className="qr-token-note">Students must belong to the session section. The server validates the exact course offering, semester, section, expiry, location and device security.</p>
      <button className="secondary-btn" onClick={close}>CLOSE ATTENDANCE</button>
    </div>}
  </section>;
}

function StudentScanner() {
  const [scanner,setScanner]=useState(null),[stage,setStage]=useState('ready'),[result,setResult]=useState(''),[error,setError]=useState('');
  const [qrToken,setQrToken]=useState('');
  const [coords,setCoords]=useState(null);
  async function verify(decoded){
    setQrToken(decoded);setStage('verifying');setError('');
    try{
      if(!navigator.geolocation)throw new Error('This device does not support location.');
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));
      setCoords({latitude:pos.coords.latitude,longitude:pos.coords.longitude});
      const fingerprint=[navigator.userAgent,navigator.platform,screen.width,screen.height,navigator.language].join('|');
      const data=await api('/sis/attendance/verify',{method:'POST',body:JSON.stringify({qrToken:decoded,latitude:pos.coords.latitude,longitude:pos.coords.longitude,deviceFingerprint:fingerprint,faceMatchStatus:'not_checked',livenessStatus:'not_checked'})});
      setResult(data.message||'Attendance marked successfully.');setStage('success');
    }catch(e){setError(e.message);setStage('error')}
  }
  async function start(){
    setError('');setResult('');setCoords(null);setStage('scanning');
    try{
      const instance=new Html5Qrcode('student-reader');setScanner(instance);
      await instance.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},async decoded=>{await instance.stop().catch(()=>{});setScanner(null);await verify(decoded)});
    }catch(e){setError(e.message);setStage('error')}
  }
  async function stop(){if(scanner){await scanner.stop().catch(()=>{});setScanner(null)}setStage('ready')}
  useEffect(()=>()=>{if(scanner)scanner.stop().catch(()=>{})},[scanner]);
  return <section className="page-card data-workspace">
    <div className="page-heading"><div><p className="eyebrow">STUDENT • ATTENDANCE</p><h2>Mark Attendance</h2><p>Scan the live faculty QR. Your section, location and device security are checked before attendance is recorded.</p></div><span className="status-pill">{stage.toUpperCase()}</span></div>
    <div className="attendance-steps"><span className={stage==='scanning'?'active':''}>1 SCAN QR</span><span className={coords?'active':''}>2 LOCATION</span><span className={stage==='verifying'?'active':''}>3 VERIFY</span><span className={stage==='success'?'active':''}>4 MARK</span></div>
    {stage==='success'?<div className="save-success attendance-result">✓ {result}</div>:<><div id="student-reader" className="scanner-box"/><div className="form-actions"><button className="sis-sign-in compact" onClick={start} disabled={stage==='verifying'}>SCAN LIVE QR</button><button className="secondary-btn" onClick={stop}>STOP</button></div></>}
    {error&&<div className="login-error">{error}</div>}
    {stage==='verifying'&&<div className="workspace-loading">Checking QR session, expiry, section, location and device security…</div>}
    {coords&&stage!=='success'&&<div className="security-note">Location captured for this attendance check.</div>}
  </section>;
}


function FacultyClassesPage() {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{api('/sis/faculty/classes').then(d=>setRows(d.classes||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  return <section className="page-card data-workspace"><div className="page-heading"><div><p className="eyebrow">FACULTY • ACADEMICS</p><h2>My Courses & Class Timetable</h2><p>Your assigned course offerings, sections and scheduled periods.</p></div></div>
    {error&&<div className="login-error">{error}</div>}
    {loading?<div className="workspace-loading">Loading class assignments...</div>:<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Course</th><th>Section</th><th>Semester</th><th>Academic Year</th><th>Room</th><th>Schedule</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id}><td><b>{r.code}</b><small>{r.name}</small></td><td>{r.section||'—'}</td><td>{r.semester||'—'}</td><td>{r.academic_year||'—'}</td><td>{r.room||'—'}</td><td>{r.day_of_week||'—'} {r.start_time||''}{r.end_time?'–'+r.end_time:''}</td></tr>)}
      {!rows.length&&<tr><td colSpan="6" className="empty-table">No course offerings or timetable entries are assigned yet.</td></tr>}
    </tbody></table></div>}
  </section>;
}

function FacultyReportsPage() {
  const [rows,setRows]=useState([]),[error,setError]=useState('');
  useEffect(()=>{api('/sis/faculty/reports/attendance').then(d=>setRows(d.reports||[])).catch(e=>setError(e.message));},[]);
  return <section className="page-card data-workspace"><div className="page-heading"><div><p className="eyebrow">FACULTY • REPORTS</p><h2>Attendance Reports</h2><p>Session history and the number of attendance records marked in each class.</p></div></div>
    {error&&<div className="login-error">{error}</div>}
    <div className="report-summary"><div><span>Sessions</span><b>{rows.length}</b></div><div><span>Total Present Records</span><b>{rows.reduce((n,r)=>n+Number(r.present_count||0),0)}</b></div></div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date / Time</th><th>Course</th><th>Section</th><th>Room</th><th>Present</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.session_id}><td>{r.started_at?new Date(r.started_at).toLocaleString('en-IN'):'—'}</td><td><b>{r.code}</b><small>{r.name}</small></td><td>{r.section||'—'}</td><td>{r.room||'—'}</td><td><span className="status-pill">{r.present_count}</span></td></tr>)}
      {!rows.length&&<tr><td colSpan="5" className="empty-table">No attendance sessions have been recorded yet.</td></tr>}
    </tbody></table></div>
  </section>;
}

function FacultyLivePage() {
  const [sessions,setSessions]=useState([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(showLoading=false){
    if(showLoading)setLoading(true);
    try{const d=await api('/sis/faculty/attendance/live');setSessions(d.sessions||[]);setSelected(current=>current&&d.sessions.some(s=>s.id===current)?current:(d.sessions[0]?.id||''));setError('');}
    catch(e){setError(e.message)}finally{if(showLoading)setLoading(false)}
  }
  useEffect(()=>{load(true);const id=setInterval(()=>load(false),3000);return()=>clearInterval(id)},[]);
  const active=sessions.find(s=>s.id===selected)||sessions[0];
  async function closeSession(id){
    try{await api('/attendance/sessions/'+id+'/close',{method:'POST'});await load(false);}
    catch(e){setError(e.message)}
  }
  return <section className="page-card data-workspace">
    <div className="page-heading"><div><p className="eyebrow">FACULTY • LIVE ATTENDANCE</p><h2>Live Attendance Control Room</h2><p>Monitor students as they are marked and review location/device security events in real time.</p></div><span className="status-pill">{sessions.length} OPEN</span></div>
    {error&&<div className="login-error">{error}</div>}
    {loading?<div className="workspace-loading">Loading live attendance...</div>:!sessions.length?<div className="empty-workspace"><b>No live sessions</b><span>Start Attendance to open a controlled QR session.</span></div>:<>
      <div className="live-session-grid">{sessions.map(s=><button type="button" className={active?.id===s.id?'live-session-card selected':'live-session-card'} key={s.id} onClick={()=>setSelected(s.id)}>
        <div className="live-dot">LIVE</div><h3>{s.subject_code||'Attendance Session'}</h3><p>Section <b>{s.section||'All'}</b> • Room <b>{s.room||'—'}</b></p><p>Present <b>{s.present_count}/{s.expected_count||0}</b></p><p>Expires <b>{s.qr_expires_at?new Date(s.qr_expires_at).toLocaleTimeString('en-IN'):'—'}</b></p>
      </button>)}</div>
      {active&&<div className="live-monitor-panel">
        <div className="page-heading"><div><p className="eyebrow">SESSION MONITOR</p><h3>{active.subject_code} — {active.subject_name}</h3><p>Section {active.section||'All'} • {active.room||'Room not set'} • Radius {active.allowed_radius_meters||'—'} m</p></div><button className="danger-btn" onClick={()=>closeSession(active.id)}>CLOSE ATTENDANCE</button></div>
        <div className="report-summary"><div><span>Present</span><b>{active.records.length}</b></div><div><span>Expected</span><b>{active.expected_count||0}</b></div><div><span>Security Events</span><b>{active.security_events.length}</b></div><div><span>Remaining</span><b>{Math.max((active.expected_count||0)-active.records.length,0)}</b></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Section</th><th>Marked At</th><th>Distance</th><th>Identity</th><th>Risk</th></tr></thead><tbody>
          {active.records.map(r=><tr key={r.id}><td><b>{r.register_no||'—'}</b><small>{r.full_name}</small></td><td>{r.section||'—'}</td><td>{r.marked_at?new Date(r.marked_at).toLocaleTimeString('en-IN'):'—'}</td><td>{r.distance_meters==null?'—':Math.round(Number(r.distance_meters))+' m'}</td><td>{r.face_match_status||'not_checked'} / {r.liveness_status||'not_checked'}</td><td><span className="status-pill">{r.risk_score??'—'}</span></td></tr>)}
          {!active.records.length&&<tr><td colSpan="6" className="empty-table">Waiting for students to scan the QR...</td></tr>}
        </tbody></table></div>
        {active.security_events.length>0&&<div className="security-note"><b>Security events:</b> {active.security_events.map(e=>e.event_type.replaceAll('_',' ')).join(' • ')}</div>}
      </div>}
    </>}
  </section>;
}

function AdminSubjectsPage() {
  const empty={code:'',name:'',department:'',semester:''};
  const [rows,setRows]=useState([]),[departments,setDepartments]=useState([]),[form,setForm]=useState(empty);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState(''),[filterDept,setFilterDept]=useState(''),[filterSem,setFilterSem]=useState('');
  const load=()=>Promise.all([api('/subjects'),api('/sis/admin/departments')]).then(([s,d])=>{setRows(s.subjects||[]);setDepartments(d.departments||[])}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{await api('/subjects',{method:'POST',body:JSON.stringify(form)});setForm(empty);setMessage('Subject created successfully.');load();}catch(e){setError(e.message)}finally{setBusy(false)}}
  const selectedSemester = filterSem || '';
  const filtered=rows.filter(r=>{
    const q=search.trim().toLowerCase();
    return (!q||[r.code,r.name,r.department,r.semester].some(v=>String(v||'').toLowerCase().includes(q))) &&
      (!filterDept||r.department===filterDept) && (!selectedSemester||String(r.semester)===selectedSemester);
  });
  const selectedDeptName = departments.find(d=>d.code===filterDept)?.name || 'All Departments';
  return <section className="page-card data-workspace">
    <div className="page-heading"><div><p className="eyebrow">ADMIN • ACADEMIC MASTER DATA</p><h2>Subjects by Department & Semester</h2><p>Select a department and semester to immediately display the subjects belonging to that semester.</p></div></div>
    <div className="master-data-banner"><strong>Academic structure</strong><span>Department → Semester → Subjects</span><small>Subjects are stored with their department and semester, so changing the semester instantly changes the displayed subject list.</small></div>
    <form className="inline-create-form" onSubmit={save}>
      <input placeholder="Subject code" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} required/>
      <input placeholder="Subject name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
      <select value={form.department} onChange={e=>setForm({...form,department:e.target.value})} required><option value="">Select department</option>{departments.map(d=><option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}</select>
      <select value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})} required><option value="">Select semester</option>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>Semester {n}</option>)}</select>
      <button className="sis-sign-in compact" disabled={busy}>{busy?'ADDING...':'ADD SUBJECT'}</button>
    </form>
    {message&&<div className="save-success">✓ {message}</div>}{error&&<div className="login-error">{error}</div>}
    <div className="student-list-toolbar">
      <div><b>{filtered.length}</b> subjects {selectedSemester ? `in Semester ${selectedSemester}` : 'available'}</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject code or name..."/>
      <select value={filterDept} onChange={e=>{setFilterDept(e.target.value);setFilterSem('')}}><option value="">All departments</option>{departments.map(d=><option key={d.code} value={d.code}>{d.code}</option>)}</select>
    </div>
    <div className="semester-selector">
      <div className="semester-selector-title"><span>SELECT SEMESTER</span><b>{selectedSemester ? `Semester ${selectedSemester}` : 'All Semesters'}</b></div>
      <div className="semester-selector-grid">
        <button type="button" className={!selectedSemester?'semester-choice active':''} onClick={()=>setFilterSem('')}>All</button>
        {[1,2,3,4,5,6,7,8].map(n=><button type="button" key={n} className={String(n)===selectedSemester?'semester-choice active':'semester-choice'} onClick={()=>setFilterSem(String(n))}>Semester {n}</button>)}
      </div>
    </div>
    <div className="selected-academic-context"><b>{selectedDeptName}</b><span>•</span><strong>{selectedSemester ? `Semester ${selectedSemester}` : 'All Semesters'}</strong><span>•</span><span>{filtered.length} subject(s)</span></div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Subject</th><th>Department</th><th>Semester</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><b>{r.code}</b></td><td>{r.name}</td><td>{r.department||'—'}</td><td><span className="status-pill">SEM {r.semester||'—'}</span></td></tr>)}{!filtered.length&&<tr><td colSpan="4" className="empty-table">No subjects are configured for this department and semester yet.</td></tr>}</tbody></table></div>
  </section>;
}

function AdminTimetablePage() {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{api('/sis/admin/timetable').then(d=>setRows(d.timetable||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  return <section className="page-card data-workspace">
    <div className="page-heading"><div><p className="eyebrow">ADMIN • ACADEMICS</p><h2>Timetable</h2><p>Central timetable view across active course offerings, sections and faculty.</p></div></div>
    {error&&<div className="login-error">{error}</div>}
    {loading?<div className="workspace-loading">Loading timetable...</div>:<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Course</th><th>Section</th><th>Semester</th><th>Faculty</th><th>Room</th><th>Schedule</th></tr></thead><tbody>
      {rows.map((r,i)=><tr key={r.id+'-'+i}><td><b>{r.code}</b><small>{r.name}</small></td><td>{r.section||'—'}</td><td>{r.semester||'—'}</td><td>{r.faculty_name||'—'}</td><td>{r.room||'—'}</td><td>{r.day_of_week||'—'} {r.start_time||''}{r.end_time?'–'+r.end_time:''}</td></tr>)}
      {!rows.length&&<tr><td colSpan="6" className="empty-table">No active timetable entries found.</td></tr>}
    </tbody></table></div>}
  </section>;
}

function AdminDepartmentsPage() {
  const empty={code:'',name:''}; const [rows,setRows]=useState([]),[form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=()=>api('/sis/admin/departments').then(d=>setRows(d.departments||[])).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{await api('/sis/admin/departments',{method:'POST',body:JSON.stringify(form)});setForm(empty);setMessage('Department created successfully.');load();}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="page-card data-workspace"><div className="page-heading"><div><p className="eyebrow">ADMIN • ORGANIZATION</p><h2>Departments</h2><p>Maintain department master data for the SIS.</p></div></div>
    <form className="inline-create-form" onSubmit={save}><input placeholder="Department code" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} required/><input placeholder="Department name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><button className="sis-sign-in compact" disabled={busy}>{busy?'ADDING...':'ADD DEPARTMENT'}</button></form>
    {message&&<div className="save-success">{message}</div>}{error&&<div className="login-error">{error}</div>}
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Department</th><th>HOD</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.code}</b></td><td>{r.name}</td><td>{r.hod_name||r.hod_id||'—'}</td></tr>)}{!rows.length&&<tr><td colSpan="3" className="empty-table">No departments found.</td></tr>}</tbody></table></div>
  </section>;
}

function AdminAuditPage() {
  const [rows,setRows]=useState([]),[error,setError]=useState('');
  useEffect(()=>{api('/sis/admin/audit-logs').then(d=>setRows(d.logs||[])).catch(e=>setError(e.message));},[]);
  return <section className="page-card data-workspace"><div className="page-heading"><div><p className="eyebrow">ADMIN • SECURITY</p><h2>Audit Logs</h2><p>Recent security and administrative actions recorded by the system.</p></div></div>
    {error&&<div className="login-error">{error}</div>}
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.created_at?new Date(r.created_at).toLocaleString('en-IN'):'—'}</td><td>{r.actor||'System'}</td><td><b>{r.action}</b></td><td>{r.entity_type||'—'}</td><td className="audit-json">{typeof r.metadata==='string'?r.metadata:JSON.stringify(r.metadata||{})}</td></tr>)}{!rows.length&&<tr><td colSpan="5" className="empty-table">No audit records found.</td></tr>}</tbody></table></div>
  </section>;
}

function AdminReportPage() {
  const [rows,setRows]=useState([]),[error,setError]=useState('');
  useEffect(()=>{api('/sis/admin/audit-logs').then(d=>setRows(d.logs||[])).catch(e=>setError(e.message));},[]);
  return <section className="page-card data-workspace"><div className="page-heading"><div><p className="eyebrow">ADMIN • REPORTING</p><h2>System Reports</h2><p>Administrative activity snapshot from the current audit stream.</p></div></div>
    {error&&<div className="login-error">{error}</div>}<div className="report-summary"><div><span>Audit events loaded</span><b>{rows.length}</b></div><div><span>Latest event</span><b>{rows[0]?.created_at?new Date(rows[0].created_at).toLocaleDateString('en-IN'):'—'}</b></div></div>
  </section>;
}


function Portal({ initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [page, setPage] = useState('Dashboard');
  const [stats, setStats] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [facultyStudents, setFacultyStudents] = useState([]);
  const [error, setError] = useState('');

  const studentMenu = ['Dashboard', 'Attendance', 'Grievances', 'Semester', 'Arrear Registration', 'Course Registration', 'OE-HSS Registration', 'Grade', 'Seating & Time Table', 'Industrial Training TPO', 'Travel History', 'One Credit', 'Online / InternIT Courses', 'NonCGPA', 'Makeup', 'Fees', 'Exam Papers', 'Course Feedback', 'Profile'];
  const facultyMenu = ['Dashboard', 'Profile', 'My Courses', 'Class Timetable', 'Start Attendance', 'Live Attendance', 'Students', 'Reports'];
  const adminMenu = ['Dashboard', 'Profile', 'Students', 'Faculty', 'Teaching Assignments', 'Departments', 'Subjects', 'Timetable', 'Reports', 'Audit Logs'];
  const menu = user.role === 'student' ? studentMenu : user.role === 'faculty' ? facultyMenu : adminMenu;

  useEffect(() => {
    const overviewPath = user.role === 'student' ? '/sis/student/overview' : user.role === 'faculty' ? '/sis/faculty/overview' : '/sis/admin/overview';
    Promise.all([
      api(overviewPath),
      api('/subjects').catch(() => ({ subjects: [] })),
      user.role === 'faculty' ? api('/faculty/students') : Promise.resolve({ students: [] })
    ])
      .then(([overview, subjectData, studentData]) => {
        setStats(user.role === 'student'
          ? { ...overview, attendance: overview.attendance || { total: 0, present: 0, percentage: 0 } }
          : overview);
        if (user.role === 'student' && overview.student) {
          const merged = { ...user, ...overview.student, name: overview.student.full_name || user.name };
          setUser(merged);
          localStorage.setItem('kare_user', JSON.stringify(merged));
        }
        if (user.role === 'faculty' && overview.faculty) {
          const merged = { ...user, ...overview.faculty, name: overview.faculty.full_name || user.name };
          setUser(merged);
          localStorage.setItem('kare_user', JSON.stringify(merged));
        }
        setSubjects(user.role === 'faculty' && Array.isArray(overview.subjects) && overview.subjects.length ? overview.subjects : (subjectData.subjects || []));
        setFacultyStudents(studentData.students || []);
      })
      .catch(e => setError(e.message));
  }, [user.role]);

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
    if (user.role === 'student' && page !== 'Dashboard') return <StudentSisModule page={page} user={user} stats={stats} />;
    if (user.role === 'admin' && page === 'Students') return <AdminStudentManagement />;
    if (user.role === 'admin' && page === 'Faculty') return <AdminFacultyFIS />;
    if (user.role === 'admin' && page === 'Teaching Assignments') return <TeachingAssignments />;
    if (user.role === 'admin' && page === 'Subjects') return <AdminSubjectsPage />;
    if (user.role === 'admin' && page === 'Departments') return <AdminDepartmentsPage />;
    if (user.role === 'admin' && page === 'Timetable') return <AdminTimetablePage />;
    if (user.role === 'admin' && page === 'Audit Logs') return <AdminAuditPage />;
    if (user.role === 'admin' && page === 'Reports') return <AdminReportPage />;
    if (user.role === 'student' && page === 'Attendance') return <StudentScanner />;
    if (user.role === 'faculty' && page === 'Start Attendance') return <FacultyAttendancePage subjects={subjects} />;
    if (user.role === 'faculty' && page === 'Live Attendance') return <FacultyLivePage />;
    if (user.role === 'faculty' && (page === 'My Courses' || page === 'Class Timetable')) return <FacultyClassesPage />;
    if (user.role === 'faculty' && page === 'Reports') return <FacultyReportsPage />;
    if (user.role === 'faculty' && page === 'Students') return <StudentManagement />;
    if (page === 'Dashboard') {
      if (user.role === 'student') return <StudentDashboard user={user} stats={stats} onNavigate={setPage} />;
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
