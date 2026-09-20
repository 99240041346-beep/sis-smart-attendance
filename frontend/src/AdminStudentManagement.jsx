import React, { useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'https://kare-one-api.onrender.com/api').replace(/\/$/, '');

async function api(path, options = {}) {
  const token = localStorage.getItem('kare_token') || sessionStorage.getItem('kare_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(options.headers||{})}
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const empty = {
  register_no:'',password:'',full_name:'',email:'',department:'',semester:'',section:'',phone:'',profile_photo_url:'',
  application_no:'',admission_no:'',admission_year:'',batch:'',academic_year:'',degree:'',programme:'',
  date_of_birth:'',gender:'',nationality:'Indian',religion:'',community:'',caste:'',blood_group:'',aadhaar_last4:'',nad_id:'',
  address:'',city:'',district:'',state:'Tamil Nadu',pincode:'',
  father_name:'',mother_name:'',parent_name:'',parent_phone:'',parent_email:'',
  emergency_contact_name:'',emergency_contact_phone:'',hosteller:false,hostel_name:'',hostel_room:'',
  transport_required:false,transport_route:'',faculty_advisor_id:'',program_id:'',extra_details:'{}'
};

function Field({label,children,wide=false}) {
  return <div className={wide?'field wide':'field'}><label>{label}</label>{children}</div>;
}

export default function AdminStudentManagement() {
  const [students,setStudents]=useState([]),[form,setForm]=useState(empty),[editing,setEditing]=useState(null);
  const [showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
  const [message,setMessage]=useState(''),[error,setError]=useState('');

  const load=()=>api('/admin/students').then(d=>setStudents(d.students||[])).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const change=(k,v)=>setForm(p=>({...p,[k]:v}));
  const reset=()=>{setForm(empty);setEditing(null);setShowForm(false);};
  const edit=s=>{
    const p=s.student_profile||s;
    setEditing(s.id);
    setForm({...empty,...s,password:'',...p,profile_photo_url:s.profile_photo_url||p.photo_url||'',extra_details:typeof p.extra_details==='string'?p.extra_details:JSON.stringify(p.extra_details||{})});
    setShowForm(true);setMessage('');setError('');
  };
  function readPhoto(file){
    if(!file)return;
    if(!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if(file.size>500*1024) return setError('Photo must be 500 KB or smaller.');
    const reader=new FileReader(); reader.onload=()=>change('profile_photo_url',reader.result); reader.readAsDataURL(file);
  }
  async function save(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      let payload={...form,extra_details:JSON.parse(form.extra_details||'{}')};
      delete payload.password;
      if(!editing){
        if(!form.password) throw new Error('Initial password is required');
        payload={...payload,password:form.password};
        const d=await api('/admin/students',{method:'POST',body:JSON.stringify(payload)});
        setStudents(p=>[d.student,...p]);setMessage(`Student account created: ${d.student.register_no}`);
      }else{
        const d=await api('/admin/students/'+editing,{method:'PATCH',body:JSON.stringify(payload)});
        setStudents(p=>p.map(x=>x.id===editing?{...x,...d.student}:x));setMessage('Student SIS details updated successfully.');
      }
      reset(); await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase(); if(!q)return students;
    return students.filter(s=>[s.register_no,s.full_name,s.email,s.department,s.section,s.admission_no,s.application_no,s.batch].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));
  },[students,search]);

  return <section className="page-card student-management">
    <div className="page-heading">
      <div><p className="eyebrow">ADMINISTRATION • STUDENTS</p><h2>Student SIS Accounts</h2><p>Create unlimited student accounts and maintain the complete SIS profile. Students have view-only access.</p></div>
      <button className="sis-sign-in compact" onClick={()=>{reset();setShowForm(true);}}>+ CREATE STUDENT</button>
    </div>
    {message&&<div className="save-success">✓ {message}</div>}{error&&<div className="login-error">{error}</div>}
    {showForm&&<form className="student-create-form" onSubmit={save}>
      <div className="student-form-title"><div><p className="eyebrow">{editing?'EDIT SIS RECORD':'NEW SIS RECORD'}</p><h3>{editing?'Edit complete student profile':'Create student account'}</h3></div><button type="button" className="secondary-btn" onClick={reset}>CANCEL</button></div>
      <div className="student-photo-editor"><div className="student-photo-preview">{form.profile_photo_url?<img src={form.profile_photo_url} alt="Student preview"/>:<span>{(form.full_name||'S').charAt(0).toUpperCase()}</span>}</div><div><label className="photo-upload-label">Student photo</label><input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/><small>Used for the attendance identity-verification profile. Maximum 500 KB.</small></div></div>

      <div className="section-label">1. Login & identity</div>
      <div className="student-form-grid">
        <Field label="Register Number"><input value={form.register_no} disabled={!!editing} onChange={e=>change('register_no',e.target.value)} required/></Field>
        {!editing&&<Field label="Initial Password"><input type="password" minLength="4" value={form.password} onChange={e=>change('password',e.target.value)} required/></Field>}
        <Field label="Full Name"><input value={form.full_name} onChange={e=>change('full_name',e.target.value)} required/></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={e=>change('email',e.target.value)}/></Field>
        <Field label="Mobile Number"><input value={form.phone} onChange={e=>change('phone',e.target.value)}/></Field>
        <Field label="Profile Photo URL"><input type="url" value={form.profile_photo_url.startsWith('data:')?'':form.profile_photo_url} onChange={e=>change('profile_photo_url',e.target.value)}/></Field>
      </div>

      <div className="section-label">2. Academic / admission details</div>
      <div className="student-form-grid">
        <Field label="Application Number"><input value={form.application_no} onChange={e=>change('application_no',e.target.value)}/></Field>
        <Field label="Admission Number"><input value={form.admission_no} onChange={e=>change('admission_no',e.target.value)}/></Field>
        <Field label="Admission Year"><input type="number" value={form.admission_year} onChange={e=>change('admission_year',e.target.value)}/></Field>
        <Field label="Batch"><input value={form.batch} onChange={e=>change('batch',e.target.value)} placeholder="2023-2027"/></Field>
        <Field label="Academic Year"><input value={form.academic_year} onChange={e=>change('academic_year',e.target.value)} placeholder="2026-27"/></Field>
        <Field label="Degree"><input value={form.degree} onChange={e=>change('degree',e.target.value)} placeholder="B.Tech"/></Field>
        <Field label="Programme"><input value={form.programme} onChange={e=>change('programme',e.target.value)} placeholder="Computer Science and Engineering"/></Field>
        <Field label="Department"><input value={form.department} onChange={e=>change('department',e.target.value)}/></Field>
        <Field label="Semester"><input value={form.semester} onChange={e=>change('semester',e.target.value)}/></Field>
        <Field label="Section"><input value={form.section} onChange={e=>change('section',e.target.value)}/></Field>
        <Field label="NAD ID"><input value={form.nad_id} onChange={e=>change('nad_id',e.target.value)}/></Field>
        <Field label="Faculty Advisor ID"><input value={form.faculty_advisor_id} onChange={e=>change('faculty_advisor_id',e.target.value)} placeholder="Optional UUID"/></Field>
      </div>

      <div className="section-label">3. Personal details</div>
      <div className="student-form-grid">
        <Field label="Date of Birth"><input type="date" value={form.date_of_birth||''} onChange={e=>change('date_of_birth',e.target.value)}/></Field>
        <Field label="Gender"><select value={form.gender} onChange={e=>change('gender',e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Nationality"><input value={form.nationality} onChange={e=>change('nationality',e.target.value)}/></Field>
        <Field label="Religion"><input value={form.religion} onChange={e=>change('religion',e.target.value)}/></Field>
        <Field label="Community"><input value={form.community} onChange={e=>change('community',e.target.value)}/></Field>
        <Field label="Caste"><input value={form.caste} onChange={e=>change('caste',e.target.value)}/></Field>
        <Field label="Blood Group"><input value={form.blood_group} onChange={e=>change('blood_group',e.target.value)}/></Field>
        <Field label="Aadhaar (last 4 only)"><input inputMode="numeric" maxLength="4" value={form.aadhaar_last4} onChange={e=>change('aadhaar_last4',e.target.value.replace(/\D/g,''))}/></Field>
      </div>

      <div className="section-label">4. Family, address & residence</div>
      <div className="student-form-grid">
        <Field label="Father Name"><input value={form.father_name} onChange={e=>change('father_name',e.target.value)}/></Field>
        <Field label="Mother Name"><input value={form.mother_name} onChange={e=>change('mother_name',e.target.value)}/></Field>
        <Field label="Parent Contact"><input value={form.parent_phone} onChange={e=>change('parent_phone',e.target.value)}/></Field>
        <Field label="Parent Email"><input type="email" value={form.parent_email} onChange={e=>change('parent_email',e.target.value)}/></Field>
        <Field label="Emergency Contact Name"><input value={form.emergency_contact_name} onChange={e=>change('emergency_contact_name',e.target.value)}/></Field>
        <Field label="Emergency Contact Phone"><input value={form.emergency_contact_phone} onChange={e=>change('emergency_contact_phone',e.target.value)}/></Field>
        <Field label="City"><input value={form.city} onChange={e=>change('city',e.target.value)}/></Field>
        <Field label="District"><input value={form.district} onChange={e=>change('district',e.target.value)}/></Field>
        <Field label="State"><input value={form.state} onChange={e=>change('state',e.target.value)}/></Field>
        <Field label="Pincode"><input value={form.pincode} onChange={e=>change('pincode',e.target.value)}/></Field>
        <Field label="Hosteller"><select value={String(form.hosteller)} onChange={e=>change('hosteller',e.target.value==='true')}><option value="false">No</option><option value="true">Yes</option></select></Field>
        <Field label="Hostel Name"><input value={form.hostel_name} onChange={e=>change('hostel_name',e.target.value)}/></Field>
        <Field label="Hostel Room"><input value={form.hostel_room} onChange={e=>change('hostel_room',e.target.value)}/></Field>
        <Field label="Transport Required"><select value={String(form.transport_required)} onChange={e=>change('transport_required',e.target.value==='true')}><option value="false">No</option><option value="true">Yes</option></select></Field>
        <Field label="Transport Route"><input value={form.transport_route} onChange={e=>change('transport_route',e.target.value)}/></Field>
        <Field label="Address" wide><textarea value={form.address} onChange={e=>change('address',e.target.value)} rows="3"/></Field>
      </div>

      <div className="section-label">5. Extended SIS data</div>
      <div className="field wide"><label>Additional details (JSON)</label><textarea value={form.extra_details} onChange={e=>change('extra_details',e.target.value)} rows="4" placeholder='{"scholarship":"","medical_note":"","custom_field":""}'/></div>
      <div className="form-actions"><button className="sis-sign-in compact" disabled={busy}>{busy?'SAVING...':editing?'SAVE STUDENT SIS':'CREATE STUDENT ACCOUNT'}</button></div>
      {!editing&&<div className="student-security-note">Unlimited account creation is controlled by the administrator. Passwords are hashed in the database and are never returned to the portal.</div>}
    </form>}

    <div className="student-list-toolbar"><div><b>{students.length}</b> student account{students.length===1?'':'s'}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search register no, name, admission no, department..."/></div>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Register</th><th>Admission</th><th>Academic</th><th>Contact</th><th>Action</th></tr></thead><tbody>
      {filtered.map(s=><tr key={s.id}><td><div className="student-cell"><div className="student-mini-photo">{s.profile_photo_url?<img src={s.profile_photo_url} alt=""/>:(s.full_name||'S').charAt(0)}</div><div><b>{s.full_name}</b><small>{s.email||'No email'}</small></div></div></td><td><strong>{s.register_no}</strong></td><td>{s.admission_no||'—'}<small>{s.application_no||''}</small></td><td>{s.programme||s.department||'—'}<small>{s.batch||''} • Sem {s.semester||'—'} • {s.section||'—'}</small></td><td>{s.phone||'—'}</td><td><button className="text-action" onClick={()=>edit(s)}>Edit</button></td></tr>)}
      {!filtered.length&&<tr><td colSpan="6" className="empty-table">No students found.</td></tr>}
    </tbody></table></div>
  </section>;
}
