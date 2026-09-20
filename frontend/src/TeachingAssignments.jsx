import React, { useEffect, useMemo, useState } from 'react';

const API=(import.meta.env.VITE_API_URL||'https://kare-one-api.onrender.com/api').replace(/\/$/,'');
async function api(path,options={}){
  const token=localStorage.getItem('kare_token')||sessionStorage.getItem('kare_token');
  const r=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(options.headers||{})}});
  const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'Request failed ('+r.status+')'); return d;
}

export default function TeachingAssignments(){
  const [faculty,setFaculty]=useState([]),[subjects,setSubjects]=useState([]),[assignments,setAssignments]=useState([]);
  const [form,setForm]=useState({faculty_id:'',semester:'',subject_id:'',section:'S1',academic_year:'2026-27',room:''});
  const [filterFaculty,setFilterFaculty]=useState(''),[filterSemester,setFilterSemester]=useState('all'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');

  async function load(){
    try{
      const [f,s,a]=await Promise.all([api('/admin/faculty'),api('/subjects'),api('/admin/teaching-assignments')]);
      setFaculty(f.faculty||[]);setSubjects(s.subjects||[]);setAssignments(a.assignments||[]);
      if(!form.faculty_id && f.faculty?.[0]) setForm(x=>({...x,faculty_id:f.faculty[0].id}));
    }catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[]);

  const filteredSubjects=useMemo(()=>subjects.filter(s=>!form.semester||String(s.semester)===String(form.semester)),[subjects,form.semester]);
  const visible=useMemo(()=>assignments.filter(a=>(!filterFaculty||a.faculty_id===filterFaculty)&&(filterSemester==='all'||String(a.semester)===filterSemester)),[assignments,filterFaculty,filterSemester]);

  function change(k,v){setForm(p=>({...p,[k]:v}))}
  async function add(e){
    e.preventDefault();setBusy(true);setMessage('');setError('');
    try{
      const d=await api('/admin/teaching-assignments',{method:'POST',body:JSON.stringify(form)});
      setMessage(d.assignment?.message||'Teaching assignment created.'); await load();
      setForm(p=>({...p,subject_id:''}));
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function toggle(a){
    try{await api('/admin/teaching-assignments/'+a.offering_id,{method:'PATCH',body:JSON.stringify({active:!a.active})});await load()}
    catch(e){setError(e.message)}
  }

  return <section className="page-card" style={{marginTop:24}}>
    <div className="page-heading">
      <div><p className="eyebrow">ACADEMIC CONTROL • FACULTY WORKLOAD</p><h2>Assign Faculty to Subjects & Sections</h2>
      <p>Admin generates the teaching workload. Faculty can only start attendance for subjects and sections assigned here.</p></div>
    </div>
    {message&&<div className="save-success">✓ {message}</div>}{error&&<div className="login-error">{error}</div>}
    <form className="student-create-form" onSubmit={add}>
      <div className="section-label">Create teaching assignment</div>
      <div className="student-form-grid">
        <div className="field"><label>Faculty</label><select value={form.faculty_id} onChange={e=>change('faculty_id',e.target.value)} required><option value="">Select faculty</option>{faculty.map(f=><option key={f.id} value={f.id}>{f.employee_id} — {f.full_name}</option>)}</select></div>
        <div className="field"><label>Semester</label><select value={form.semester} onChange={e=>change('semester',e.target.value)} required><option value="">Select semester</option>{[1,2,3,4,5,6,7,8].map(x=><option key={x} value={x}>Semester {x}</option>)}</select></div>
        <div className="field wide"><label>Subject</label><select value={form.subject_id} onChange={e=>change('subject_id',e.target.value)} required disabled={!form.semester}><option value="">{form.semester?'Select subject':'Select semester first'}</option>{filteredSubjects.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></div>
        <div className="field"><label>Section</label><input value={form.section} onChange={e=>change('section',e.target.value.toUpperCase())} placeholder="S1" required/></div>
        <div className="field"><label>Academic Year</label><input value={form.academic_year} onChange={e=>change('academic_year',e.target.value)} placeholder="2026-27" required/></div>
        <div className="field"><label>Class Room</label><input value={form.room} onChange={e=>change('room',e.target.value)} placeholder="KARE BLOCK / Room"/></div>
      </div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy}>{busy?'ASSIGNING...':'ASSIGN SUBJECT TO FACULTY'}</button></div>
    </form>
    <div className="student-list-toolbar"><div><b>{visible.length}</b> teaching assignment{visible.length===1?'':'s'}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><select value={filterFaculty} onChange={e=>setFilterFaculty(e.target.value)}><option value="">All faculty</option>{faculty.map(f=><option key={f.id} value={f.id}>{f.employee_id}</option>)}</select>
      <select value={filterSemester} onChange={e=>setFilterSemester(e.target.value)}><option value="all">All semesters</option>{[1,2,3,4,5,6,7,8].map(x=><option key={x} value={x}>Sem {x}</option>)}</select></div>
    </div>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Faculty</th><th>Subject</th><th>Semester</th><th>Section</th><th>Academic Year</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {visible.map(a=><tr key={a.offering_id}><td><strong>{a.employee_id}</strong><small>{a.full_name}</small></td><td><strong>{a.code}</strong><small>{a.name}</small></td><td>Sem {a.semester}</td><td><strong>{a.section}</strong></td><td>{a.academic_year}</td><td>{a.active?'Active':'Closed'}</td><td><button className="text-action" onClick={()=>toggle(a)}>{a.active?'Close':'Reactivate'}</button></td></tr>)}
      {!visible.length&&<tr><td colSpan="7" className="empty-table">No teaching assignments found.</td></tr>}
    </tbody></table></div>
  </section>
}
