import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Html5Qrcode} from 'html5-qrcode';
import {QrCode, MapPin, ShieldCheck, LayoutDashboard, Clock, Users, LogOut, Camera, CheckCircle, XCircle} from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function Scanner({onResult}) {
  const [error,setError]=useState('');
  useEffect(()=>{
    const scanner=new Html5Qrcode('qr-reader');
    let active=true;
    scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},text=>{
      if(!active)return;
      try { onResult(JSON.parse(text)); } catch { setError('Invalid KARE ONE attendance QR code.'); }
    },()=>{}).catch(e=>setError('Camera access failed. Allow camera permission and use HTTPS.'));
    return ()=>{active=false;scanner.stop().catch(()=>{});scanner.clear().catch(()=>{});};
  },[onResult]);
  return <div><div id="qr-reader" style={{width:'100%',maxWidth:420}}></div>{error&&<div className="error">{error}</div>}</div>;
}

function AttendanceScanner({token}) {
  const [step,setStep]=useState('scan'),[qr,setQr]=useState(null),[gps,setGps]=useState(null),[result,setResult]=useState(null),[error,setError]=useState('');
  const handleQr=(data)=>{if(!data?.sessionId||!data?.token){setError('Invalid QR payload.');return;}setQr(data);setStep('gps');};
  const getGps=()=>{setError('');if(!navigator.geolocation){setError('GPS is not supported by this browser.');return;}setStep('locating');navigator.geolocation.getCurrentPosition(p=>{setGps({latitude:p.coords.latitude,longitude:p.coords.longitude});setStep('verify');},e=>{setStep('gps');setError(`Location permission failed: ${e.message}`);},{enableHighAccuracy:true,timeout:10000,maximumAge:0});};
  const submit=async()=>{setError('');setStep('submitting');try{const r=await fetch(API+'/attendance/submit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({sessionId:qr.sessionId,token:qr.token,latitude:gps.latitude,longitude:gps.longitude,faceVerified:false,livenessVerified:false})});const d=await r.json();if(!r.ok)throw Error(d.error||'Attendance rejected');setResult(d);setStep('done');}catch(e){setError(e.message);setStep('verify');}};
  if(step==='done')return <div className="panel"><CheckCircle/><h2>Attendance Recorded</h2><p>You are marked present.</p><p>Distance: {Math.round(result.distanceMeters)} m</p></div>;
  return <div className="panel wide"><h2><QrCode/> Secure Attendance</h2>{error&&<div className="error">{error}</div>}{step==='scan'&&<><p>Scan the QR displayed by your faculty.</p><Scanner onResult={handleQr}/></>}{step==='gps'&&<><p>QR accepted. Your location is required to continue.</p><button onClick={getGps}><MapPin/> Allow GPS & Continue</button></>}{step==='locating'&&<p>Getting your precise location…</p>}{step==='verify'&&<><div className="checks"><span><QrCode/> QR verified</span><span><MapPin/> GPS captured</span><span><ShieldCheck/> Face verification required</span></div><p className="muted">Face/liveness must be completed by the production face service before attendance can be accepted.</p><button disabled>Continue after face verification</button></>}{step==='submitting'&&<p>Submitting attendance securely…</p>}</div>;
}
function App(){const[token,setToken]=useState(localStorage.getItem('kare_token'));const[user,setUser]=useState(JSON.parse(localStorage.getItem('kare_user')||'null'));const[page,setPage]=useState('Dashboard');const[login,setLogin]=useState({identifier:'student@kare.local',password:'Student@123'});const[error,setError]=useState('');
 async function signIn(e){e.preventDefault();setError('');try{const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(login)});const d=await r.json();if(!r.ok)throw Error(d.error);localStorage.setItem('kare_token',d.token);localStorage.setItem('kare_user',JSON.stringify(d.user));setToken(d.token);setUser(d.user);}catch(x){setError(x.message)}}
 if(!token)return <main className="login"><div className="login-card"><div className="brand">KARE <span>ONE</span></div><p className="muted">Student Information System</p><form onSubmit={signIn}><label>Email / Register Number<input value={login.identifier} onChange={e=>setLogin({...login,identifier:e.target.value})}/></label><label>Password<input type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label>{error&&<div className="error">{error}</div>}<button>Sign in</button></form></div></main>;
 const nav=user.role==='STUDENT'?['Dashboard','Attendance','Timetable','Scan QR','Profile']:user.role==='FACULTY'?['Dashboard','Start Attendance','Live Attendance','Reports']:['Dashboard','Students','Faculty','Subjects','Attendance','Audit Logs'];
 return <div className="shell"><aside><div className="brand">KARE <span>ONE</span></div><div className="role">{user.role}</div>{nav.map(n=><button className={page===n?'nav active':'nav'} onClick={()=>setPage(n)} key={n}>{n==='Dashboard'?<LayoutDashboard/>:n==='Scan QR'?<QrCode/>:n==='Attendance'?<ShieldCheck/>:n==='Timetable'?<Clock/>:<Users/>}{n}</button>)}<button className="nav logout" onClick={()=>{localStorage.clear();location.reload()}}><LogOut/>Logout</button></aside><section className="content"><header><div><small>Student Information System</small><h1>{page}</h1></div><div className="user">{user.name}<span>{user.registerNumber||user.email}</span></div></header><div className="grid">{page==='Dashboard'?<><Card title="Attendance" value="87%"/><Card title="Today's Classes" value="5"/><Card title="Security Status" value="Protected"/><div className="panel wide"><h2>Secure Attendance</h2><p>QR + face/liveness + GPS distance validation protect attendance against proxy attempts.</p><div className="checks"><span><QrCode/> QR</span><span><Camera/> Face</span><span><MapPin/> GPS</span></div></div></>:page==='Scan QR'&&user.role==='STUDENT'?<AttendanceScanner token={token}/>:<div className="panel wide"><h2>{page}</h2><p>This SIS module is connected to the KARE ONE protected API.</p></div>}</div></section></div>}
function Card({title,value}){return <div className="panel card"><small>{title}</small><strong>{value}</strong></div>}
createRoot(document.getElementById('root')).render(<App/>);
