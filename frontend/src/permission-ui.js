const API=(import.meta.env.VITE_API_URL||'http://localhost:4000/api')+'/permissions';
const token=()=>localStorage.getItem('kare_token');
const user=()=>{try{return JSON.parse(localStorage.getItem('kare_user')||'null')}catch{return null}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function req(path='',opts={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(API+path,{...opts,signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`,...(opts.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d.error||`Permission request failed (${r.status})`);
    return d;
  }catch(e){
    if(e.name==='AbortError')throw Error('Permission service timed out. Please try again.');
    if(e instanceof TypeError)throw Error('Cannot connect to the KARE ONE API. Please check the backend service.');
    throw e;
  }finally{clearTimeout(timer)}
}

function openUI(){
  if(document.querySelector('.permission-fab'))return;
  const u=user();
  if(!u||!['student','faculty','admin'].includes(u.role))return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`<button class="permission-fab" type="button">▣ Permissions</button><div class="permission-backdrop" hidden><div class="permission-modal" role="dialog" aria-modal="true"><header><div><strong>Permission Management</strong><small>KARE SIS • ${esc(u.role)}</small></div><button class="permission-close" type="button" aria-label="Close">×</button></header><div class="permission-body"><p class="permission-muted">Clicking Permissions will load your requests.</p></div></div></div>`;
  document.body.append(wrap);
  const back=wrap.querySelector('.permission-backdrop'),body=wrap.querySelector('.permission-body');
  const close=()=>{back.hidden=true;document.body.classList.remove('permission-open')};
  wrap.querySelector('.permission-fab').onclick=()=>{back.hidden=false;document.body.classList.add('permission-open');render()};
  wrap.querySelector('.permission-close').onclick=close;
  back.addEventListener('click',e=>{if(e.target===back)close()});

  async function render(){
    body.innerHTML='<div class="permission-loading"><span class="permission-spinner"></span><b>Loading permission management…</b><small>Connecting to KARE ONE API</small></div>';
    try{u.role==='student'?await student():await reviewer(u.role)}
    catch(e){body.innerHTML=`<div class="permission-error"><b>Permission Management could not load</b><p>${esc(e.message)}</p><button type="button" class="permission-refresh retry">Retry</button></div>`;body.querySelector('.retry').onclick=render}
  }

  async function student(){
    const rows=await req('/mine');
    body.innerHTML=`<section class="permission-card"><h3>Request Permission</h3><form class="permission-form"><div class="permission-grid"><label>Type<select name="permissionType"><option>Class Permission</option><option>On Duty</option><option>Medical Leave</option><option>Late Entry</option><option>Early Exit</option></select></label><label>Date<input name="permissionDate" type="date" required></label><label>Start<input name="startTime" type="time"></label><label>End<input name="endTime" type="time"></label></div><label>Reason<textarea name="reason" required placeholder="Reason for permission"></textarea></label><button class="permission-primary" type="submit">Submit for Approval</button><span class="permission-msg"></span></form></section><section class="permission-card"><h3>My Requests</h3>${rows.length?rows.map(r=>`<article class="permission-row"><div><b>${esc(r.permission_type)}</b><small>${esc(r.permission_date)} ${esc(r.start_time||'')} ${r.end_time?'– '+esc(r.end_time):''}</small><p>${esc(r.reason)}</p></div><span class="permission-status ${String(r.status).toLowerCase()}">${esc(r.status)}</span>${r.status==='Pending'?`<button type="button" class="permission-cancel" data-cancel="${r.id}">Cancel</button>`:''}</article>`).join(''):'<p class="permission-muted">No requests submitted.</p>'}</section>`;
    body.querySelector('form').onsubmit=async e=>{e.preventDefault();const msg=body.querySelector('.permission-msg');msg.textContent='Submitting…';try{const data=Object.fromEntries(new FormData(e.currentTarget).entries());await req('',{method:'POST',body:JSON.stringify(data)});msg.textContent='Submitted successfully. Waiting for approval.';await render()}catch(x){msg.textContent=x.message}};
    body.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await req('/'+b.dataset.cancel+'/cancel',{method:'PATCH'});await render()}catch(x){b.disabled=false;alert(x.message)}});
  }

  async function reviewer(role){
    const rows=await req(role==='admin'?'/admin/all':'/faculty/pending');
    body.innerHTML=`<section class="permission-card"><div class="permission-title"><h3>${role==='admin'?'All Permission Requests':'Permission Approvals'}</h3><button type="button" class="permission-refresh">Refresh</button></div>${rows.length?rows.map(r=>`<article class="permission-row"><div><b>${esc(r.student_name||'Student')} ${r.register_number?'• '+esc(r.register_number):''}</b><small>${esc(r.permission_type)} • ${esc(r.permission_date)}</small><p>${esc(r.reason)}</p></div><span class="permission-status ${String(r.status).toLowerCase()}">${esc(r.status)}</span>${r.status==='Pending'||(role==='admin'&&r.status==='Approved')?`<div class="permission-actions"><button type="button" data-id="${r.id}" data-decision="Approved" class="permission-approve">Approve</button><button type="button" data-id="${r.id}" data-decision="Rejected" class="permission-reject">Reject</button></div>`:''}</article>`).join(''):'<p class="permission-muted">No permission requests found.</p>'}</section>`;
    body.querySelector('.permission-refresh')?.addEventListener('click',render);
    body.querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{const remarks=prompt('Remarks (optional):')||'';b.disabled=true;try{await req('/'+b.dataset.id+(role==='admin'?'/admin-review':'/review'),{method:'PATCH',body:JSON.stringify({decision:b.dataset.decision,remarks})});await render()}catch(x){b.disabled=false;alert(x.message)}});
  }

  const style=document.createElement('style');style.textContent=`
.permission-fab{position:fixed;right:22px;bottom:22px;z-index:9998;border:0;border-radius:24px;padding:12px 18px;background:#0aa6c2;color:white;font-weight:700;cursor:pointer;box-shadow:0 5px 18px #0004}
.permission-backdrop{position:fixed;inset:0;z-index:9999;background:#0007;display:flex;align-items:center;justify-content:center;padding:18px}
.permission-modal{background:#fff;color:#24343b;width:min(900px,96vw);max-height:90vh;overflow:auto;border-radius:8px;box-shadow:0 20px 70px #0008}
.permission-modal header{background:#168db1;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
.permission-modal header strong,.permission-modal header small{display:block}.permission-modal header strong{font-size:17px}.permission-modal header small{margin-top:3px;opacity:.9}
.permission-modal header button{background:none;border:0;color:#fff;font-size:28px;cursor:pointer;line-height:1}
.permission-body{padding:2px;min-height:180px}.permission-card{margin:16px;padding:16px;border:1px solid #dce3e7;border-radius:6px;background:#fff}.permission-card h3{margin:0 0 14px;color:#176d8a}
.permission-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.permission-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:700;margin-bottom:10px}.permission-form input,.permission-form select,.permission-form textarea{padding:9px;border:1px solid #cbd6db;border-radius:4px;font:inherit}.permission-form textarea{min-height:75px}.permission-primary,.permission-approve,.permission-reject,.permission-cancel,.permission-refresh{border:0;border-radius:4px;padding:8px 12px;font-weight:700;cursor:pointer}.permission-primary{background:#0aa6c2;color:#fff}.permission-approve{background:#178b55;color:#fff}.permission-reject{background:#c33;color:#fff}.permission-cancel,.permission-refresh{background:#e9eef1;color:#345}.permission-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;border:1px solid #e2e7ea;padding:12px;margin:8px 0;border-radius:5px}.permission-row small,.permission-row p{display:block;margin:4px 0;color:#667}.permission-row p{font-size:13px}.permission-status{padding:5px 9px;border-radius:12px;font-size:12px;font-weight:700}.permission-status.pending{background:#fff0c2;color:#8a6200}.permission-status.approved{background:#dff5e8;color:#126b3d}.permission-status.rejected{background:#fde1e1;color:#9b2222}.permission-status.cancelled{background:#eee;color:#666}.permission-actions{display:flex;gap:5px}.permission-title{display:flex;justify-content:space-between;align-items:center}.permission-muted{text-align:center;color:#667;padding:16px}.permission-error{margin:30px 16px;text-align:center;padding:24px;border:1px solid #f0cccc;background:#fff7f7;color:#8b2c2c;border-radius:6px}.permission-error p{margin:10px 0 16px}.permission-loading{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#176d8a}.permission-loading small{color:#667}.permission-spinner{width:30px;height:30px;border:3px solid #d9e9ee;border-top-color:#0aa6c2;border-radius:50%;animation:permission-spin .8s linear infinite}@keyframes permission-spin{to{transform:rotate(360deg)}}.permission-msg{margin-left:10px;color:#176d8a}
@media(max-width:650px){.permission-grid,.permission-row{grid-template-columns:1fr}.permission-actions{flex-wrap:wrap}.permission-fab{right:12px;bottom:12px}}
`;document.head.append(style);
}

setTimeout(openUI,800);
window.addEventListener('storage',openUI);
setInterval(()=>{if(user()&&!document.querySelector('.permission-fab'))openUI()},1500);
