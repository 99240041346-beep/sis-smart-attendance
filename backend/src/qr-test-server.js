require('dotenv').config();
const express=require('express');
const cors=require('cors');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const QRCode=require('qrcode');
const path=require('path');
const {query,transaction,ensureSchema}=require('./db');

const app=express();
const PORT=Number(process.env.QR_TEST_PORT||4010);
const SECRET=process.env.JWT_SECRET||process.env.SECRET_KEY||'development-only-secret';
const UI_DIR=path.join(__dirname,'..','qr-test-ui');
app.use(cors());
app.use(express.json({limit:'1mb'}));
app.use(express.static(UI_DIR));

const auth=(req,res,next)=>{try{const h=req.headers.authorization||'';req.user=jwt.verify(h.startsWith('Bearer ')?h.slice(7):'',SECRET);next()}catch{res.status(401).json({error:'Authentication required'})}};
const role=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Insufficient role'});
const sha256=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const sign=u=>jwt.sign({id:u.id,role:u.role,email:u.email,jti:crypto.randomUUID()},SECRET,{expiresIn:'8h'});

async function seed(){
  const users=[
    ['student@kare.local','QR Test Student','student','99240041346','Harsha@2006'],
    ['faculty@kare.local','QR Test Faculty','faculty',null,'Faculty@123'],
    ['admin@kare.local','QR Test Admin','admin',null,'Admin@123']
  ];
  for(const [email,name,role,register,password] of users){
    const q=await query('SELECT id FROM app_users WHERE lower(email)=lower($1) LIMIT 1',[email]);
    const hash=await bcrypt.hash(password,12);
    if(q.rowCount) await query('UPDATE app_users SET name=$1,role=$2,register_number=COALESCE($3,register_number),password_hash=$4 WHERE id=$5',[name,role,register,hash,q.rows[0].id]);
    else await query('INSERT INTO app_users(email,name,role,register_number,password_hash,department,programme,academic_year,semester) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[email,name,role,register,hash,'Computer Science and Engineering','B.Tech','2024','6']);
  }
}

app.get('/api/health',async(_req,res)=>{try{await query('SELECT 1');res.json({ok:true,service:'KARE ONE QR Test API',database:'connected'})}catch(e){res.status(503).json({ok:false,error:'Database unavailable'})}});

app.post('/api/login',async(req,res)=>{
  try{
    const {identity,password}=req.body||{};
    const q=await query('SELECT * FROM app_users WHERE lower(email)=lower($1) OR register_number=$1 LIMIT 1',[identity]);
    const u=q.rows[0];
    if(!u||!password||!(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({error:'Invalid login'});
    res.json({token:sign(u),user:{id:u.id,name:u.name,email:u.email,role:u.role,registerNumber:u.register_number}});
  }catch(e){res.status(500).json({error:'Login failed'})}
});

app.post('/api/qr/session',auth,role('faculty','admin'),async(req,res)=>{
  try{
    const {subjectId=null,className='QR Test Class',durationSeconds=120}=req.body||{};
    const duration=Math.min(600,Math.max(30,Number(durationSeconds)||120));
    let subject=null;
    if(subjectId){const s=await query('SELECT id,code,name FROM subjects WHERE id::text=$1 OR code=$1 LIMIT 1',[subjectId]);if(!s.rowCount)return res.status(400).json({error:'Subject not found'});subject=s.rows[0];}
    const rawToken=crypto.randomBytes(32).toString('hex');
    const expiresAt=new Date(Date.now()+duration*1000);
    const q=await query(`INSERT INTO attendance_sessions(subject_id,faculty_id,class_name,qr_token_hash,faculty_latitude,faculty_longitude,allowed_radius_m,expires_at,active) VALUES($1,$2,$3,$4,0,0,1000,$5,true) RETURNING id,subject_id,class_name,expires_at,active,created_at`,[subject?.id||null,req.user.id,className,sha256(rawToken),expiresAt]);
    const session=q.rows[0];
    const payload={type:'KARE_QR_ATTENDANCE',sessionId:session.id,token:rawToken,expiresAt:session.expires_at};
    const qr=await QRCode.toDataURL(JSON.stringify(payload),{margin:2,width:320});
    await query('INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)',[req.user.id,'QR_TEST_SESSION_CREATED',JSON.stringify({sessionId:session.id,subjectId:subject?.id||null})]);
    res.status(201).json({session,subject,qr,qrPayload:payload});
  }catch(e){console.error(e);res.status(500).json({error:'Could not create QR test session'})}
});

app.post('/api/qr/mark',auth,role('student'),async(req,res)=>{
  try{
    const {sessionId,token}=req.body||{};
    if(!sessionId||!token)return res.status(400).json({error:'QR session and token are required'});
    const result=await transaction(async client=>{
      const s=(await client.query('SELECT * FROM attendance_sessions WHERE id=$1 FOR UPDATE',[sessionId])).rows[0];
      if(!s)return Object.assign(new Error('Attendance session not found'),{status:404});
      if(!s.active||new Date(s.expires_at)<=new Date())return Object.assign(new Error('QR attendance session expired'),{status:409});
      if(sha256(token)!==s.qr_token_hash)return Object.assign(new Error('Invalid QR token'),{status:409});
      const student=(await client.query("SELECT id,register_number,name FROM app_users WHERE id=$1 AND role='student'",[req.user.id])).rows[0];
      if(!student)return Object.assign(new Error('Student account required'),{status:403});
      const duplicate=(await client.query('SELECT id,created_at FROM attendance_records WHERE session_id=$1 AND student_id=$2',[sessionId,student.id])).rows[0];
      if(duplicate)return Object.assign(new Error('Attendance already registered for this session'),{status:409});
      const ins=await client.query(`INSERT INTO attendance_records(session_id,student_id,register_number,qr_verified,face_verified,liveness_verified,status) VALUES($1,$2,$3,true,false,false,'Present') RETURNING id,session_id,student_id,register_number,status,created_at`,[sessionId,student.id,student.register_number]);
      await client.query('INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)',[student.id,'QR_TEST_ATTENDANCE_MARKED',JSON.stringify({sessionId})]);
      return ins.rows[0];
    });
    res.status(201).json({success:true,attendance:result,message:'QR attendance marked successfully'});
  }catch(e){res.status(e.status||500).json({error:e.message||'Attendance failed'})}
});

app.get('/api/qr/session/:id',auth,role('faculty','admin'),async(req,res)=>{
  try{
    const s=(await query('SELECT id,subject_id,class_name,expires_at,active,created_at FROM attendance_sessions WHERE id=$1',[req.params.id])).rows[0];
    if(!s)return res.status(404).json({error:'Session not found'});
    const records=(await query('SELECT a.id,a.register_number,a.status,a.created_at,u.name FROM attendance_records a JOIN app_users u ON u.id=a.student_id WHERE a.session_id=$1 ORDER BY a.created_at',[req.params.id])).rows;
    res.json({session:s,records,count:records.length});
  }catch(e){res.status(500).json({error:'Could not load attendance'})}
});

app.post('/api/qr/session/:id/close',auth,role('faculty','admin'),async(req,res)=>{try{const q=await query('UPDATE attendance_sessions SET active=false WHERE id=$1 AND faculty_id=$2 RETURNING id,active,expires_at',[req.params.id,req.user.id]);if(!q.rowCount)return res.status(404).json({error:'Session not found or not owned by you'});res.json(q.rows[0])}catch(e){res.status(500).json({error:'Could not close session'})}});

app.get('*',(req,res)=>res.sendFile(path.join(UI_DIR,'index.html')));

(async()=>{try{await ensureSchema();await seed();app.listen(PORT,'0.0.0.0',()=>console.log(`KARE ONE QR Test Server running at http://localhost:${PORT}`))}catch(e){console.error('QR test server startup failed',e);process.exit(1)}})();
