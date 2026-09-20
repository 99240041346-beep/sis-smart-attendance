import React, { useEffect, useMemo, useState } from 'react';
import TeachingAssignments from './TeachingAssignments';

const API=(import.meta.env.VITE_API_URL||'https://kare-one-api.onrender.com/api').replace(/\/$/,'');
async function api(path,options={}){
  const token=localStorage.getItem('kare_token')||sessionStorage.getItem('kare_token');
  const r=await fetch(`${API}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...(options.headers||{})}});
  const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||`Request failed (${r.status})`); return d;
}
const empty={employee_id:'',password:'',full_name:'',email:'',department:'',designation:'',phone:'',profile_photo_url:'',
 faculty_id_code:'',school:'',faculty_type:'',employment_status:'active',gender:'',date_of_birth:'',nationality:'Indian',
 alternate_phone:'',address:'',qualification:'',specialization:'',research_area:'',joining_date:'',relieving_date:'',
 office_room:'',experience_years:'',extra_details:'{}'};
function Field({label,children,wide=false}){return <div className={wide?'field wide':'field'}><label>{label}</label>{children}</div>}

export default function AdminFacultyManagement(){
  const [faculty,setFaculty]=useState([]),[form,setForm]=useState(empty),[editing,setEditing]=useState(null),[showForm,setShowForm]=useState(false);
  const [busy,setBusy]=useState(false),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  const load=()=>api('/admin/faculty').then(d=>setFaculty(d.faculty||[])).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const change=(k,v)=>setForm(p=>({...p,[k]:v}));
  const reset=()=>{setForm(empty);setEditing(null);setShowForm(false)};
  const edit=f=>{setEditing(f.id);setForm({...empty,...f,password:'',profile_photo_url:f.profile_photo_url||f.photo_url||'',extra_details:typeof f.extra_details==='string'?f.extra_details:JSON.stringify(f.extra_details||{})});setShowForm(true);setMessage('');setError('')};
  async function save(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      const payload={...form,extra_details:JSON.parse(form.extra_details||'{}')}; if(editing)delete payload.password;
      const d=await api(editing?'/admin/faculty/'+editing:'/admin/faculty',{method:editing?'PATCH':'POST',body:JSON.stringify(payload)});
      if(editing)setFaculty(p=>p.map(x=>x.id===editing?d.faculty:x));else setFaculty(p=>[d.faculty,...p]);
      setMessage(editing?'Faculty SIS details updated successfully.':`Faculty account created: ${d.faculty.employee_id}`);reset();await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return faculty;return faculty.filter(f=>[f.employee_id,f.full_name,f.email,f.department,f.designation,f.school,f.qualification].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))},[faculty,search]);
  return <section className="page-card student-management">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION • FACULTY</p><h2>Faculty Information System</h2><p>Create unlimited faculty accounts and maintain employment, academic and professional profile details.</p></div><button className="sis-sign-in compact" onClick={()=>{reset();setShowForm(true)}}>+ CREATE FACULTY</button></div>
    {message&&<div className="save-success">✓ {message}</div>}{error&&<div className="login-error">{error}</div>}
    {showForm&&<form className="student-create-form" onSubmit={save}>
      <div className="student-form-title"><div><p className="eyebrow">{editing?'EDIT FIS RECORD':'NEW FIS RECORD'}</p><h3>{editing?'Edit complete faculty profile':'Create faculty account'}</h3></div><button type="button" className="secondary-btn" onClick={reset}>CANCEL</button></div>
      <div className="section-label">1. Account & identity</div>
      <div className="student-form-grid">
        <Field label="Employee ID"><input value={form.employee_id} disabled={!!editing} onChange={e=>change('employee_id',e.target.value)} required/></Field>
        {!editing&&<Field label="Initial Password"><input type="password" minLength="4" value={form.password} onChange={e=>change('password',e.target.value)} required/></Field>}
        <Field label="Faculty ID"><input value={form.faculty_id_code} onChange={e=>change('faculty_id_code',e.target.value)}/></Field>
        <Field label="Full Name"><input value={form.full_name} onChange={e=>change('full_name',e.target.value)} required/></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={e=>change('email',e.target.value)}/></Field>
        <Field label="Mobile Number"><input value={form.phone} onChange={e=>change('phone',e.target.value)}/></Field>
        <Field label="Alternate Phone"><input value={form.alternate_phone} onChange={e=>change('alternate_phone',e.target.value)}/></Field>
        <Field label="Profile Photo URL"><input type="url" value={form.profile_photo_url.startsWith('data:')?'':form.profile_photo_url} onChange={e=>change('profile_photo_url',e.target.value)}/></Field>
      </div>
      <div className="section-label">2. Employment & department</div>
      <div className="student-form-grid">
        <Field label="Department"><input value={form.department} onChange={e=>change('department',e.target.value)}/></Field>
        <Field label="School"><input value={form.school} onChange={e=>change('school',e.target.value)}/></Field>
        <Field label="Designation"><input value={form.designation} onChange={e=>change('designation',e.target.value)}/></Field>
        <Field label="Faculty Type"><input value={form.faculty_type} onChange={e=>change('faculty_type',e.target.value)} placeholder="Teaching / Research / Visiting"/></Field>
        <Field label="Employment Status"><select value={form.employment_status} onChange={e=>change('employment_status',e.target.value)}><option>active</option><option>on_leave</option><option>inactive</option></select></Field>
        <Field label="Joining Date"><input type="date" value={form.joining_date||''} onChange={e=>change('joining_date',e.target.value)}/></Field>
        <Field label="Relieving Date"><input type="date" value={form.relieving_date||''} onChange={e=>change('relieving_date',e.target.value)}/></Field>
        <Field label="Office Room"><input value={form.office_room} onChange={e=>change('office_room',e.target.value)}/></Field>
      </div>
      <div className="section-label">3. Personal & professional details</div>
      <div className="student-form-grid">
        <Field label="Date of Birth"><input type="date" value={form.date_of_birth||''} onChange={e=>change('date_of_birth',e.target.value)}/></Field>
        <Field label="Gender"><select value={form.gender} onChange={e=>change('gender',e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Nationality"><input value={form.nationality} onChange={e=>change('nationality',e.target.value)}/></Field>
        <Field label="Qualification"><input value={form.qualification} onChange={e=>change('qualification',e.target.value)} placeholder="M.E., Ph.D., etc."/></Field>
        <Field label="Specialization"><input value={form.specialization} onChange={e=>change('specialization',e.target.value)}/></Field>
        <Field label="Research Area"><input value={form.research_area} onChange={e=>change('research_area',e.target.value)}/></Field>
        <Field label="Experience (years)"><input type="number" step="0.1" value={form.experience_years} onChange={e=>change('experience_years',e.target.value)}/></Field>
        <Field label="Address" wide><textarea value={form.address} onChange={e=>change('address',e.target.value)} rows="3"/></Field>
      </div>
      <div className="section-label">4. Extended FIS / AR data</div>
      <div className="field wide"><label>Additional professional details (JSON)</label><textarea value={form.extra_details} onChange={e=>change('extra_details',e.target.value)} rows="5" placeholder='{"publications":[],"events_attended":[],"honours":[],"memberships":[],"on_duty":[]}'/></div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy}>{busy?'SAVING...':editing?'SAVE FACULTY SIS':'CREATE FACULTY ACCOUNT'}</button></div>
      {!editing&&<div className="student-security-note">Unlimited faculty creation is controlled by the administrator. Passwords are hashed and never returned.</div>}
    </form>}
    <div className="student-list-toolbar"><div><b>{faculty.length}</b> faculty account{faculty.length===1?'':'s'}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee ID, name, department, qualification..."/></div>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Faculty</th><th>Employee ID</th><th>Department</th><th>Designation</th><th>Qualification</th><th>Action</th></tr></thead><tbody>
      {filtered.map(f=><tr key={f.id}><td><div className="student-cell"><div className="student-mini-photo">{f.profile_photo_url?<img src={f.profile_photo_url} alt=""/>:(f.full_name||'F').charAt(0)}</div><div><b>{f.full_name}</b><small>{f.email||'No email'}</small></div></div></td><td><strong>{f.employee_id}</strong></td><td>{f.department||'—'}<small>{f.school||''}</small></td><td>{f.designation||'—'}</td><td>{f.qualification||'—'}</td><td><button className="text-action" onClick={()=>edit(f)}>Edit</button></td></tr>)}
      {!filtered.length&&<tr><td colSpan="6" className="empty-table">No faculty accounts found.</td></tr>}
    </tbody></table></div>
    <TeachingAssignments />
  </section>;
}
