import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'https://kare-one-api.onrender.com/api').replace(/\/$/, '');
const roles = [
  { key:'student', label:'Student', hint:'Register number' },
  { key:'faculty', label:'Faculty', hint:'Faculty ID / email' },
  { key:'admin', label:'Admin', hint:'Admin email' }
];

async function api(path, options={}) {
  const token = localStorage.getItem('kare_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(options.headers||{}) }
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function Login({ onLogin }) {
  const [role,setRole]=useState('student'); const [identifier,setIdentifier]=useState(''); const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const submit=async(e)=>{e.preventDefault();setBusy(true);setError('');try{const data=await api('/auth/login',{method:'POST',body:JSON.stringify({identifier:identifier.trim(),password,role})});localStorage.setItem('kare_token',data.token);localStorage.setItem('kare_user',JSON.stringify(data.user));onLogin(data.user);}catch(err){setError(err.message)}finally{setBusy(false)}};
  const selected=roles.find(r=>r.key===role);
  return <main className="auth-page"><section className="auth-card"><div className="brand-mark">K</div><p className="eyebrow">KALASALINGAM ACADEMY</p><h1>KARE ONE</h1><p className="subtitle">SIS Smart Attendance</p><div className="role-tabs">{roles.map(r=><button type="button" key={r.key} className={role===r.key?'active':''} onClick={()=>setRole(r.key)}>{r.label}</button>)}</div><form onSubmit={submit}><label>{selected.hint}</label><input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder={selected.hint} required autoComplete="username"/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Enter password" required autoComplete="current-password"/>{error&&<div className="error">{error}</div>}<button className="primary" disabled={busy}>{busy?'SIGNING IN…':'SIGN IN'}</button></form><p className="status-note">Secure role-based portal • QR attendance foundation</p></section></main>;
}

function QRGenerator({ subjects }) {
  const [subjectId,setSubjectId]=useState(''); const [section,setSection]=useState(''); const [room,setRoom]=useState(''); const [session,setSession]=useState(null); const [error,setError]=useState('');
  const canvas=useRef(null);
  useEffect(()=>{ if(session?.qrToken&&canvas.current) QRCode.toCanvas(canvas.current,session.qrToken,{width:300,margin:2,errorCorrectionLevel:'M'}); },[session]);
  const start=async()=>{setError('');try{const data=await api('/attendance/sessions',{method:'POST',body:JSON.stringify({subjectId,section,room,durationSeconds:60})});setSession(data);}catch(e){setError(e.message)}};
  const close=async()=>{try{await api(`/attendance/sessions/${session.session.id}/close`,{method:'POST'});setSession({...session,session:{...session.session,status:'closed'}})}catch(e){setError(e.message)}};
  return <div className="feature"><div className="feature-head"><div><p className="eyebrow">FACULTY • QR ATTENDANCE</p><h3>Start a live attendance session</h3></div><span className="badge">60 SEC QR</span></div>{!session?<><div className="form-grid"><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Select subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select><input placeholder="Section" value={section} onChange={e=>setSection(e.target.value)}/><input placeholder="Room" value={room} onChange={e=>setRoom(e.target.value)}/></div><button className="primary compact" disabled={!subjectId} onClick={start}>GENERATE DYNAMIC QR</button></>:<div className="qr-panel"><div><canvas ref={canvas}/><p className="qr-note">Students scan this QR from the live classroom screen.</p></div><div><h4>{session.session.code||'Attendance Session'}</h4><p>Session: {session.session.id}</p><p>Status: <b>{session.session.status}</b></p><p>Expires: {new Date(session.session.qr_expires_at).toLocaleTimeString()}</p><button className="danger" onClick={close} disabled={session.session.status==='closed'}>CLOSE SESSION</button></div></div>}{error&&<div className="error">{error}</div>}</div>;
}

function QRScanner() {
  const [result,setResult]=useState(''); const [error,setError]=useState(''); const scanner=useRef(null);
  const start=async()=>{setError('');setResult('');try{scanner.current=new Html5Qrcode('reader');await scanner.current.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},async(decoded)=>{try{const data=await api('/attendance/scan',{method:'POST',body:JSON.stringify({qrToken:decoded})});setResult(data.message);await scanner.current.stop();}catch(e){setError(e.message)}});}catch(e){setError(e.message)}};
  const stop=async()=>{if(scanner.current){try{await scanner.current.stop()}catch{}scanner.current=null}};
  useEffect(()=>()=>{stop()},[]);
  return <div className="feature"><div className="feature-head"><div><p className="eyebrow">STUDENT • ATTENDANCE</p><h3>Scan classroom QR</h3></div><span className="badge">QR ONLY</span></div><div id="reader" className="reader"></div><div className="scanner-actions"><button className="primary compact" onClick={start}>START SCANNER</button><button className="secondary compact" onClick={stop}>STOP</button></div>{result&&<div className="success">✓ {result}</div>}{error&&<div className="error">{error}</div>}</div>;
}

function Dashboard({user,onLogout}) {
  const [subjects,setSubjects]=useState([]); const [stats,setStats]=useState({}); const [error,setError]=useState('');
  useEffect(()=>{Promise.all([api('/dashboard'),api('/subjects')]).then(([d,s])=>{setStats(d);setSubjects(s.subjects||[])}).catch(e=>setError(e.message))},[]);
  const student=user.role==='student'; const faculty=user.role==='faculty';
  const menus=student?['Dashboard','Profile','Attendance','Timetable','Subjects','Notifications','Leave Requests','History']:faculty?['Dashboard','Profile','My Courses','Class Timetable','Start Attendance','Live Attendance','Students','Reports']:['Dashboard','Users','Students','Faculty','Departments','Subjects','Timetable','Reports','Audit Logs'];
  return <div className="portal"><aside className="sidebar"><div className="side-brand"><span>K</span><div><strong>KARE ONE</strong><small>SIS SMART ATTENDANCE</small></div></div><nav>{menus.map((m,i)=><button className={i===0?'selected':''} key={m}>{m}</button>)}</nav><button className="logout" onClick={onLogout}>SIGN OUT</button></aside><main className="dashboard"><header><div><p className="eyebrow">{user.role.toUpperCase()} PORTAL</p><h2>Welcome, {user.name}</h2><p className="muted">{user.department||'KARE ONE'} {user.register_no?`• ${user.register_no}`:''}</p></div><div className="user-chip">{user.role}</div></header>{error&&<div className="error">{error}</div>}<section className="cards"><article><span>01</span><h4>Database</h4><p>Users, subjects and attendance records</p><b>CONNECTED VIA API</b></article><article><span>02</span><h4>QR Attendance</h4><p>Dynamic session and one-record-per-student protection</p><b>ACTIVE</b></article><article><span>03</span><h4>Security</h4><p>Face, GPS and anti-proxy will be layered next</p><b>PLANNED</b></article></section>{student&&<section className="feature-grid"><QRScanner/><div className="feature stats"><p className="eyebrow">ATTENDANCE SUMMARY</p><h3>{stats.attendance?.present||0} / {stats.attendance?.total||0}</h3><p>Present records</p><div className="stat-line"><span>Attendance foundation</span><strong>QR</strong></div></div></section>}{faculty&&<QRGenerator subjects={subjects}/>} {user.role==='admin'&&<section className="feature"><p className="eyebrow">ADMIN CORE</p><h3>System foundation</h3><p>Manage users and subjects through the API. Database migrations and production administration are separated from attendance security layers.</p></section>}</main></div>;
}

function App(){const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('kare_user')||'null')}catch{return null}});const logout=()=>{localStorage.removeItem('kare_token');localStorage.removeItem('kare_user');setUser(null)};return user?<Dashboard user={user} onLogout={logout}/>:<Login onLogin={setUser}/>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
