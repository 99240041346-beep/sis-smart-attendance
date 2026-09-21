const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');
const { initDb } = require('./initDb');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const DEMO_USERS = {
  student: { id: 'demo-student', register_no: 'student', employee_id: null, full_name: 'Demo Student', email: 'student@kare.edu', role: 'student', department: 'Computer Science and Engineering', semester: 1, section: 'S1', password: 'student' },
  faculty1: { id: 'demo-faculty-1', register_no: null, employee_id: 'FAC001', full_name: 'Dr. Arjun Kumar', email: 'faculty1@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00001', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty1'] },
  faculty2: { id: 'demo-faculty-2', register_no: null, employee_id: 'FAC002', full_name: 'Dr. Priya Nair', email: 'faculty2@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00002', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty2'] },
  faculty3: { id: 'demo-faculty-3', register_no: null, employee_id: 'FAC003', full_name: 'Prof. Rahul Varma', email: 'faculty3@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00003', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty3'] },
  faculty4: { id: 'demo-faculty-4', register_no: null, employee_id: 'FAC004', full_name: 'Dr. Meena Krishnan', email: 'faculty4@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00004', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty4'] },
  faculty5: { id: 'demo-faculty-5', register_no: null, employee_id: 'FAC005', full_name: 'Prof. Suresh Babu', email: 'faculty5@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00005', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty5'] },
  admin: { id: 'demo-admin', register_no: null, employee_id: 'admin', full_name: 'Demo Administrator', email: 'admin@kare.edu', role: 'admin', department: null, semester: null, section: null, password: 'admin' },
  // Backward compatibility for faculty JWTs issued before the five-account migration.
  'demo-faculty': { id: 'demo-faculty', register_no: null, employee_id: 'FAC001', full_name: 'Dr. Arjun Kumar', email: 'faculty1@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00001', designation: 'Assistant Professor', password: 'faculty123', login_aliases: ['faculty','faculty1'] }
};

function demoLogin(identifier, password, role) {
  const user = Object.values(DEMO_USERS).find(candidate => {
    if (candidate.role !== role || candidate.password !== password) return false;
    const accepted = [candidate.register_no, candidate.employee_id, candidate.email, ...(candidate.login_aliases || [])].filter(Boolean).map(String).map(v => v.toLowerCase());
    return accepted.includes(String(identifier).toLowerCase());
  });
  return user || null;
}

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (process.env.DATABASE_URL) {
    try { await query('SELECT 1'); database = 'connected'; } catch (_err) { database = 'error'; }
  }
  res.json({ ok: true, service: 'KARE ONE API', phase: 1, database, authentication: 'available' });
});

function auth(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET is not configured' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_err) { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
function requireRole(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Insufficient role' }); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET is not configured' });
    const { identifier, password, role } = req.body || {};
    if (!identifier || !password || !role) return res.status(400).json({ error: 'identifier, password and role are required' });
    try {
      const result = await query(`SELECT id, register_no, employee_id, full_name, email, password_hash, role, department, semester, section, phone, designation, profile_photo_url, account_status FROM users WHERE is_active=true AND role=$1 AND (register_no=$2 OR employee_id=$2 OR lower(email)=lower($2)) LIMIT 1`, [role, identifier]);
      const user = result.rows[0];
      if (user && await bcrypt.compare(password, user.password_hash)) {
        const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
        delete user.password_hash;
        return res.json({ token, user: { ...user, name: user.full_name }, source: 'database' });
      }
      if (user) return res.status(401).json({ error: 'Invalid credentials' });
    } catch (dbError) { console.warn('Database unavailable during login; using demo authentication:', dbError.code || dbError.message); }
    const user = demoLogin(identifier, password, role);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name, demo: true }, JWT_SECRET, { expiresIn: '8h' });
    const { password: _password, ...safeUser } = user;
    return res.json({ token, user: { ...safeUser, name: user.full_name }, source: 'demo' });
  } catch (err) { console.error(err); res.status(503).json({ error: 'Authentication service unavailable' }); }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    if (req.user.demo) { const demo = DEMO_USERS[req.user.sub]; if (!demo) return res.status(404).json({ error: 'User not found' }); const { password: _password, ...safeUser } = demo; return res.json({ user: { ...safeUser, name: demo.full_name } }); }
    const r = await query(`SELECT id,register_no,employee_id,full_name,email,role,department,semester,section,phone,designation,profile_photo_url,account_status FROM users WHERE id=$1 AND is_active=true`, [req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...r.rows[0], name: r.rows[0].full_name } });
  } catch (_err) { res.status(503).json({ error: 'Database unavailable' }); }
});

app.patch('/api/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Profile changes are controlled by the administrator' });
    const { full_name, email, department, semester, section, phone, designation, profile_photo_url } = req.body || {};
    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: 'Full name is required' });

    if (req.user.demo) {
      const demo = DEMO_USERS[req.user.sub];
      if (!demo) return res.status(404).json({ error: 'User not found' });
      const updated = {
        ...demo,
        full_name: String(full_name).trim(),
        email: email ? String(email).trim() : demo.email,
        department: department ?? demo.department,
        semester: semester ?? demo.semester,
        section: section ?? demo.section,
        phone: phone ?? demo.phone ?? null,
        designation: designation ?? demo.designation ?? null,
        profile_photo_url: profile_photo_url ?? demo.profile_photo_url ?? null
      };
      return res.json({ user: { ...updated, password: undefined, name: updated.full_name } });
    }

    const r = await query(`UPDATE users
      SET full_name=$1,email=$2,department=$3,semester=$4,section=$5,phone=$6,designation=$7,profile_photo_url=$8,updated_at=NOW()
      WHERE id=$9 AND is_active=true
      RETURNING id,register_no,employee_id,full_name,email,role,department,semester,section,phone,designation,profile_photo_url`,
      [String(full_name).trim(), email || null, department || null, semester || null, section || null, phone || null, designation || null, profile_photo_url || null, req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: { ...r.rows[0], name: r.rows[0].full_name } });
  } catch (err) {
    console.error('Profile update failed:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Email is already in use' });
    return res.status(503).json({ error: 'Profile service unavailable' });
  }
});

app.get('/api/admin/faculty', auth, requireRole('admin'), async (req, res) => {
  try {
    if (req.user.demo) {
      const faculty = Object.values(DEMO_USERS).filter(u => u.role === 'faculty').map(({ password, ...u }) => ({ ...u, name: u.full_name }));
      return res.json({ faculty });
    }
    const r = await query(`SELECT u.id,u.employee_id,u.full_name,u.email,u.department,u.designation,u.phone,u.profile_photo_url,u.is_active,u.account_status,u.created_at,
      fp.faculty_id_code,fp.school,fp.faculty_type,fp.employment_status,fp.gender,fp.date_of_birth,fp.nationality,fp.alternate_phone,fp.address,
      fp.qualification,fp.specialization,fp.research_area,fp.joining_date,fp.relieving_date,fp.office_room,fp.experience_years,fp.photo_url,fp.extra_details
      FROM users u LEFT JOIN faculty_profiles fp ON fp.faculty_id=u.id
      WHERE u.role='faculty' AND u.is_active=true ORDER BY u.employee_id,u.full_name`);
    return res.json({ faculty: r.rows.map(u => ({ ...u, name: u.full_name, profile_photo_url:u.profile_photo_url||u.photo_url })) });
  } catch (_err) { return res.status(503).json({ error: 'Faculty service unavailable' }); }
});

app.get('/api/admin/teaching-assignments', auth, requireRole('admin'), async (req,res)=>{
  try {
    // Demo admin authentication is only an identity layer; assignments remain database-backed.

    const r=await query(`SELECT o.id AS offering_id,o.semester,o.section,o.academic_year,o.room,o.active,
      u.id AS faculty_id,u.employee_id,u.full_name,
      s.id AS subject_id,s.code,s.name,s.department
      FROM course_offerings o
      JOIN users u ON u.id=o.faculty_id AND u.role='faculty'
      JOIN subjects s ON s.id=o.subject_id
      ORDER BY u.employee_id,o.academic_year DESC,o.semester::int,s.code,o.section`);
    res.json({assignments:r.rows});
  } catch(err){ console.error('Teaching assignment list failed:',err.message); res.status(503).json({error:'Teaching assignments unavailable'}); }
});

app.post('/api/admin/teaching-assignments', auth, requireRole('admin'), async (req,res)=>{
  try {
    const {faculty_id,subject_id,semester,section,academic_year,room}=req.body||{};
    if(!faculty_id||!subject_id||!semester||!section||!academic_year) return res.status(400).json({error:'Faculty, subject, semester, section and academic year are required'});
    if(!/^[1-8]$/.test(String(semester))) return res.status(400).json({error:'Semester must be 1 to 8'});
    // Admin demo accounts display stable demo IDs, but teaching assignments must
    // reference the real PostgreSQL faculty UUID. Resolve demo faculty IDs by employee ID.
    let facultyLookup = String(faculty_id);
    const demoFaculty = Object.values(DEMO_USERS).find(u => u.role === 'faculty' && String(u.id) === facultyLookup);
    if (demoFaculty?.employee_id) facultyLookup = demoFaculty.employee_id;
    const f=await query(
      facultyLookup === String(faculty_id) && /^[0-9a-fA-F-]{36}$/.test(facultyLookup)
        ? `SELECT id,employee_id,full_name FROM users WHERE id=$1::uuid AND role='faculty' AND is_active=true`
        : `SELECT id,employee_id,full_name FROM users WHERE employee_id=$1 AND role='faculty' AND is_active=true`,
      [facultyLookup]
    );
    if(!f.rows[0]) return res.status(404).json({error:'Faculty account is not available in the database. Create the faculty account first.'});
    const sub=await query(`SELECT id,code,name,department FROM subjects WHERE id=$1`,[subject_id]);
    if(!sub.rows[0]) return res.status(404).json({error:'Subject not found'});
    const resolvedFacultyId=f.rows[0].id;
    const existing=await query(`SELECT id FROM course_offerings WHERE subject_id=$1 AND faculty_id=$2 AND semester=$3 AND section=$4 AND academic_year=$5 LIMIT 1`,[subject_id,resolvedFacultyId,String(semester),String(section).trim(),String(academic_year).trim()]);
    if(existing.rows[0]){
      const r=await query(`UPDATE course_offerings SET active=true,room=$1 WHERE id=$2 RETURNING id`,[room||null,existing.rows[0].id]);
      return res.json({assignment:{offering_id:r.rows[0].id,message:'Existing teaching assignment reactivated'}});
    }
    const r=await query(`INSERT INTO course_offerings(subject_id,faculty_id,semester,section,academic_year,room,active) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id`,[subject_id,resolvedFacultyId,String(semester),String(section).trim(),String(academic_year).trim(),room||null]);
    res.status(201).json({assignment:{offering_id:r.rows[0].id,message:'Teaching assignment created'}});
  } catch(err){ console.error('Teaching assignment create failed:',err.code||err.message); if(err.code==='23505') return res.status(409).json({error:'This faculty-subject-semester-section-year assignment already exists'}); res.status(503).json({error:'Unable to create teaching assignment'}); }
});

app.patch('/api/admin/teaching-assignments/:id', auth, requireRole('admin'), async (req,res)=>{
  try {
    const {active,room}=req.body||{};
    const r=await query(`UPDATE course_offerings SET active=COALESCE($1,active),room=COALESCE($2,room) WHERE id=$3 RETURNING id,active,room`,[typeof active==='boolean'?active:null,room??null,req.params.id]);
    if(!r.rows[0]) return res.status(404).json({error:'Teaching assignment not found'});
    res.json({assignment:r.rows[0]});
  } catch(err){ console.error('Teaching assignment update failed:',err.message); res.status(503).json({error:'Unable to update teaching assignment'}); }
});

app.post('/api/admin/faculty', auth, requireRole('admin'), async (req, res) => {
  try {
    const {
      employee_id,password,full_name,email,department,designation,phone,profile_photo_url,
      faculty_id_code,school,faculty_type,employment_status,gender,date_of_birth,nationality,
      alternate_phone,address,qualification,specialization,research_area,joining_date,relieving_date,
      office_room,experience_years,extra_details
    } = req.body || {};
    if (!employee_id || !password || !full_name) return res.status(400).json({ error: 'Employee ID, password and full name are required' });
    if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (String(profile_photo_url || '').length > 700000) return res.status(400).json({ error: 'Profile photo is too large' });
    if (req.user.demo) {
      const key = String(employee_id).trim().toLowerCase();
      const exists = Object.values(DEMO_USERS).find(u => u.role === 'faculty' && [u.employee_id,u.email].filter(Boolean).map(v=>String(v).toLowerCase()).includes(key));
      if (exists) return res.status(409).json({ error: 'Faculty employee ID or email already exists' });
      const id = 'demo-faculty-' + crypto.randomBytes(5).toString('hex');
      DEMO_USERS[id] = { id, register_no:null, employee_id:String(employee_id).trim(), full_name:String(full_name).trim(), email:email?String(email).trim():null, role:'faculty', department:department||null, semester:null, section:null, phone:phone||null, designation:designation||null, profile_photo_url:profile_photo_url||null, password:String(password),
        faculty_profile:{faculty_id_code:faculty_id_code||null,school:school||null,faculty_type:faculty_type||null,employment_status:employment_status||'active',gender:gender||null,date_of_birth:date_of_birth||null,nationality:nationality||null,alternate_phone:alternate_phone||null,address:address||null,qualification:qualification||null,specialization:specialization||null,research_area:research_area||null,joining_date:joining_date||null,relieving_date:relieving_date||null,office_room:office_room||null,experience_years:experience_years??null,photo_url:profile_photo_url||null,extra_details:extra_details||{}} };
      const { password: _password, ...safe } = DEMO_USERS[id];
      return res.status(201).json({ faculty:{...safe,name:safe.full_name} });
    }
    const passwordHash = await bcrypt.hash(String(password), 12);
    const r = await query(`INSERT INTO users(employee_id,full_name,email,password_hash,role,department,designation,phone,profile_photo_url)
      VALUES($1,$2,$3,$4,'faculty',$5,$6,$7,$8)
      RETURNING id,employee_id,full_name,email,role,department,designation,phone,profile_photo_url,is_active,created_at`,
      [String(employee_id).trim(),String(full_name).trim(),email?String(email).trim():null,passwordHash,department||null,designation||null,phone||null,profile_photo_url||null]);
    const f=r.rows[0];
    await query(`INSERT INTO faculty_profiles(faculty_id,faculty_id_code,school,faculty_type,employment_status,gender,date_of_birth,nationality,alternate_phone,address,qualification,specialization,research_area,joining_date,relieving_date,office_room,experience_years,photo_url,extra_details)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT(faculty_id) DO UPDATE SET faculty_id_code=EXCLUDED.faculty_id_code,school=EXCLUDED.school,faculty_type=EXCLUDED.faculty_type,employment_status=EXCLUDED.employment_status,gender=EXCLUDED.gender,date_of_birth=EXCLUDED.date_of_birth,nationality=EXCLUDED.nationality,alternate_phone=EXCLUDED.alternate_phone,address=EXCLUDED.address,qualification=EXCLUDED.qualification,specialization=EXCLUDED.specialization,research_area=EXCLUDED.research_area,joining_date=EXCLUDED.joining_date,relieving_date=EXCLUDED.relieving_date,office_room=EXCLUDED.office_room,experience_years=EXCLUDED.experience_years,photo_url=EXCLUDED.photo_url,extra_details=EXCLUDED.extra_details,updated_at=NOW()`,
      [f.id,faculty_id_code||null,school||null,faculty_type||null,employment_status||'active',gender||null,date_of_birth||null,nationality||null,alternate_phone||null,address||null,qualification||null,specialization||null,research_area||null,joining_date||null,relieving_date||null,office_room||null,experience_years??null,profile_photo_url||null,extra_details||{}]);
    return res.status(201).json({ faculty:{...f,name:f.full_name} });
  } catch(err) {
    if(err.code==='23505') return res.status(409).json({error:'Employee ID or email is already in use'});
    console.error('Faculty creation failed:',err.message);
    return res.status(503).json({error:'Unable to create faculty'});
  }
});

app.patch('/api/admin/faculty/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const b=req.body||{};
    if(!b.full_name||!String(b.full_name).trim())return res.status(400).json({error:'Full name is required'});
    if(String(b.profile_photo_url||'').length>700000)return res.status(400).json({error:'Profile photo is too large'});
    if(req.user.demo){
      const faculty=DEMO_USERS[req.params.id];
      if(!faculty||faculty.role!=='faculty')return res.status(404).json({error:'Faculty not found'});
      Object.assign(faculty,{full_name:String(b.full_name).trim(),email:b.email||null,department:b.department||null,designation:b.designation||null,phone:b.phone||null,profile_photo_url:b.profile_photo_url||null});
      faculty.faculty_profile={...(faculty.faculty_profile||{}),...b};
      const {password:_password,...safe}=faculty; return res.json({faculty:{...safe,name:safe.full_name}});
    }
    const r=await query(`UPDATE users SET full_name=$1,email=$2,department=$3,designation=$4,phone=$5,profile_photo_url=$6,updated_at=NOW()
      WHERE id=$7 AND role='faculty' AND is_active=true
      RETURNING id,employee_id,full_name,email,role,department,designation,phone,profile_photo_url,is_active,account_status`,
      [String(b.full_name).trim(),b.email||null,b.department||null,b.designation||null,b.phone||null,b.profile_photo_url||null,req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Faculty not found'});
    await query(`INSERT INTO faculty_profiles(faculty_id,faculty_id_code,school,faculty_type,employment_status,gender,date_of_birth,nationality,alternate_phone,address,qualification,specialization,research_area,joining_date,relieving_date,office_room,experience_years,photo_url,extra_details)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT(faculty_id) DO UPDATE SET faculty_id_code=EXCLUDED.faculty_id_code,school=EXCLUDED.school,faculty_type=EXCLUDED.faculty_type,employment_status=EXCLUDED.employment_status,gender=EXCLUDED.gender,date_of_birth=EXCLUDED.date_of_birth,nationality=EXCLUDED.nationality,alternate_phone=EXCLUDED.alternate_phone,address=EXCLUDED.address,qualification=EXCLUDED.qualification,specialization=EXCLUDED.specialization,research_area=EXCLUDED.research_area,joining_date=EXCLUDED.joining_date,relieving_date=EXCLUDED.relieving_date,office_room=EXCLUDED.office_room,experience_years=EXCLUDED.experience_years,photo_url=EXCLUDED.photo_url,extra_details=EXCLUDED.extra_details,updated_at=NOW()`,
      [req.params.id,b.faculty_id_code||null,b.school||null,b.faculty_type||null,b.employment_status||'active',b.gender||null,b.date_of_birth||null,b.nationality||null,b.alternate_phone||null,b.address||null,b.qualification||null,b.specialization||null,b.research_area||null,b.joining_date||null,b.relieving_date||null,b.office_room||null,b.experience_years??null,b.profile_photo_url||null,b.extra_details||{}]);
    return res.json({faculty:{...r.rows[0],name:r.rows[0].full_name}});
  } catch(err){if(err.code==='23505')return res.status(409).json({error:'Email is already in use'});console.error(err);return res.status(503).json({error:'Unable to update faculty'});}
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    if (req.user.demo) { if (req.user.role === 'student') return res.json({ role: 'student', attendance: { total: 0, present: 0 } }); if (req.user.role === 'faculty') return res.json({ role: 'faculty', sessions: 0 }); return res.json({ role: 'admin', users: 3 }); }
    if (req.user.role === 'student') { const r = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='present')::int AS present FROM attendance_records WHERE student_id=$1`, [req.user.sub]); return res.json({ role: 'student', attendance: r.rows[0] }); }
    if (req.user.role === 'faculty') { const r = await query(`SELECT COUNT(*)::int AS sessions FROM attendance_sessions WHERE faculty_id=$1`, [req.user.sub]); return res.json({ role: 'faculty', sessions: r.rows[0].sessions }); }
    const r = await query(`SELECT COUNT(*)::int AS users FROM users WHERE is_active=true`); res.json({ role: 'admin', users: r.rows[0].users });
  } catch (_err) { res.status(503).json({ error: 'Database unavailable' }); }
});

app.get('/api/faculty/students', auth, requireRole('faculty'), async (req, res) => {
  try {
    if (req.user.demo) return res.json({ students: Object.values(DEMO_USERS).filter(u => u.role === 'student').map(({ password, ...u }) => ({ ...u, name: u.full_name })) });
    const r = await query(`SELECT id,register_no,full_name,email,department,semester,section,phone,profile_photo_url,is_active,created_at FROM users WHERE role='student' AND is_active=true ORDER BY register_no,full_name`);
    res.json({ students: r.rows.map(u => ({ ...u, name: u.full_name })) });
  } catch (_err) { res.status(503).json({ error: 'Student service unavailable' }); }
});

app.post('/api/faculty/students', auth, requireRole('faculty'), async (req, res) => {
  try {
    const { register_no, password, full_name, email, department, semester, section, phone, profile_photo_url } = req.body || {};
    if (!register_no || !password || !full_name) return res.status(400).json({ error: 'Register number, password and full name are required' });
    if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (String(profile_photo_url || '').length > 700000) return res.status(400).json({ error: 'Profile photo is too large. Use an image below about 500 KB.' });
    if (req.user.demo) {
      const key = String(register_no).trim().toLowerCase();
      const existing = Object.values(DEMO_USERS).find(u => u.role === 'student' && [u.register_no, u.email].filter(Boolean).map(v => String(v).toLowerCase()).includes(key));
      if (existing) return res.status(409).json({ error: 'A student with this register number or email already exists' });
      const id = `demo-student-${crypto.randomBytes(5).toString('hex')}`;
      DEMO_USERS[id] = { id, register_no:String(register_no).trim(), employee_id:null, full_name:String(full_name).trim(), email:email ? String(email).trim() : null, role:'student', department:department||null, semester:semester||null, section:section||null, phone:phone||null, profile_photo_url:profile_photo_url||null, password:String(password) };
      const { password: _password, ...safe } = DEMO_USERS[id];
      return res.status(201).json({ student:{ ...safe, name:safe.full_name } });
    }
    const passwordHash = await bcrypt.hash(String(password), 12);
    const r = await query(`INSERT INTO users (register_no,full_name,email,password_hash,role,department,semester,section,phone,profile_photo_url)
      VALUES($1,$2,$3,$4,'student',$5,$6,$7,$8,$9)
      RETURNING id,register_no,full_name,email,role,department,semester,section,phone,profile_photo_url,is_active,created_at`,
      [String(register_no).trim(),String(full_name).trim(),email ? String(email).trim() : null,passwordHash,department||null,semester||null,section||null,phone||null,profile_photo_url||null]);
    const student = r.rows[0];
    res.status(201).json({ student:{ ...student, name:student.full_name } });
  } catch (err) {
    console.error('Student creation failed:', err.message);
    if (err.code === '23505') return res.status(409).json({ error:'Register number or email is already in use' });
    res.status(503).json({ error:'Unable to create student' });
  }
});

app.patch('/api/faculty/students/:id', auth, requireRole('faculty'), async (req, res) => {
  try {
    const { full_name,email,department,semester,section,phone,profile_photo_url } = req.body || {};
    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error:'Full name is required' });
    if (String(profile_photo_url || '').length > 700000) return res.status(400).json({ error:'Profile photo is too large' });
    if (req.user.demo) {
      const student = DEMO_USERS[req.params.id];
      if (!student || student.role !== 'student') return res.status(404).json({ error:'Student not found' });
      Object.assign(student,{full_name:String(full_name).trim(),email:email||null,department:department||null,semester:semester||null,section:section||null,phone:phone||null,profile_photo_url:profile_photo_url||null});
      const { password: _password, ...safe } = student;
      return res.json({ student:{ ...safe, name:safe.full_name } });
    }
    const r = await query(`UPDATE users SET full_name=$1,email=$2,department=$3,semester=$4,section=$5,phone=$6,profile_photo_url=$7,updated_at=NOW()
      WHERE id=$8 AND role='student' AND is_active=true
      RETURNING id,register_no,full_name,email,role,department,semester,section,phone,profile_photo_url,is_active`,
      [String(full_name).trim(),email||null,department||null,semester||null,section||null,phone||null,profile_photo_url||null,req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error:'Student not found' });
    res.json({ student:{ ...r.rows[0], name:r.rows[0].full_name } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error:'Email is already in use' });
    res.status(503).json({ error:'Unable to update student' });
  }
});

/* Admin-managed student accounts and full SIS profiles */
app.get('/api/admin/students', auth, requireRole('admin'), async (req,res)=>{
  try {
    if(req.user.demo) return res.json({students:Object.values(DEMO_USERS).filter(u=>u.role==='student').map(({password,...u})=>({...u,name:u.full_name}))});
    const r=await query(`SELECT u.id,u.register_no,u.employee_id,u.full_name,u.email,u.department,u.semester,u.section,u.phone,u.profile_photo_url,u.is_active,u.account_status,u.created_at,
      sp.application_no,sp.admission_no,sp.admission_year,sp.batch,sp.academic_year,sp.degree,sp.programme,sp.date_of_birth,sp.gender,sp.nationality,sp.religion,sp.community,sp.caste,sp.blood_group,sp.aadhaar_last4,sp.nad_id,
      sp.address,sp.city,sp.district,sp.state,sp.pincode,sp.father_name,sp.mother_name,sp.parent_name,sp.parent_phone,sp.parent_email,sp.emergency_contact_name,sp.emergency_contact_phone,
      sp.hosteller,sp.hostel_name,sp.hostel_room,sp.transport_required,sp.transport_route,sp.faculty_advisor_id,sp.program_id,sp.photo_url,sp.extra_details,
      fa.full_name AS faculty_advisor_name
      FROM users u LEFT JOIN student_profiles sp ON sp.student_id=u.id
      LEFT JOIN users fa ON fa.id=sp.faculty_advisor_id
      WHERE u.role='student' ORDER BY u.register_no,u.full_name`);
    res.json({students:r.rows.map(u=>({...u,name:u.full_name,profile_photo_url:u.profile_photo_url||u.photo_url}))});
  } catch(err){console.error(err);res.status(503).json({error:'Student service unavailable'});}
});

app.post('/api/admin/students', auth, requireRole('admin'), async (req,res)=>{
  try{
    const {
      register_no,password,full_name,email,department,semester,section,phone,profile_photo_url,
      application_no,admission_no,admission_year,batch,academic_year,degree,programme,date_of_birth,gender,
      nationality,religion,community,caste,blood_group,aadhaar_last4,nad_id,address,city,district,state,pincode,
      father_name,mother_name,parent_name,parent_phone,parent_email,emergency_contact_name,emergency_contact_phone,
      hosteller,hostel_name,hostel_room,transport_required,transport_route,faculty_advisor_id,program_id,extra_details
    }=req.body||{};
    if(!register_no||!password||!full_name)return res.status(400).json({error:'Register number, password and full name are required'});
    if(String(password).length<4)return res.status(400).json({error:'Password must be at least 4 characters'});
    if(String(aadhaar_last4||'').length>4)return res.status(400).json({error:'Aadhaar field accepts only the last 4 digits'});
    if(String(profile_photo_url||'').length>700000)return res.status(400).json({error:'Profile photo is too large'});
    if(req.user.demo){
      const key=String(register_no).trim().toLowerCase();
      const exists=Object.values(DEMO_USERS).find(u=>u.role==='student'&&[u.register_no,u.email].filter(Boolean).map(v=>String(v).toLowerCase()).includes(key));
      if(exists)return res.status(409).json({error:'Register number or email already exists'});
      const id='demo-student-'+crypto.randomBytes(5).toString('hex');
      DEMO_USERS[id]={id,register_no:String(register_no).trim(),employee_id:null,full_name:String(full_name).trim(),email:email?String(email).trim():null,role:'student',department:department||null,semester:semester||null,section:section||null,phone:phone||null,profile_photo_url:profile_photo_url||null,password:String(password),
        student_profile:{application_no:application_no||null,admission_no:admission_no||null,admission_year:admission_year??null,batch:batch||null,academic_year:academic_year||null,degree:degree||null,programme:programme||null,date_of_birth:date_of_birth||null,gender:gender||null,nationality:nationality||null,religion:religion||null,community:community||null,caste:caste||null,blood_group:blood_group||null,aadhaar_last4:aadhaar_last4||null,nad_id:nad_id||null,address:address||null,city:city||null,district:district||null,state:state||null,pincode:pincode||null,father_name:father_name||null,mother_name:mother_name||null,parent_name:parent_name||null,parent_phone:parent_phone||null,parent_email:parent_email||null,emergency_contact_name:emergency_contact_name||null,emergency_contact_phone:emergency_contact_phone||null,hosteller:Boolean(hosteller),hostel_name:hostel_name||null,hostel_room:hostel_room||null,transport_required:Boolean(transport_required),transport_route:transport_route||null,faculty_advisor_id:faculty_advisor_id||null,program_id:program_id||null,photo_url:profile_photo_url||null,extra_details:extra_details||{}}};
      const {password:_password,...safe}=DEMO_USERS[id]; return res.status(201).json({student:{...safe,name:safe.full_name}});
    }
    const passwordHash=await bcrypt.hash(String(password),12);
    const r=await query(`INSERT INTO users(register_no,full_name,email,password_hash,role,department,semester,section,phone,profile_photo_url)
      VALUES($1,$2,$3,$4,'student',$5,$6,$7,$8,$9)
      RETURNING id,register_no,full_name,email,role,department,semester,section,phone,profile_photo_url,is_active,account_status,created_at`,
      [String(register_no).trim(),String(full_name).trim(),email?String(email).trim():null,passwordHash,department||null,semester||null,section||null,phone||null,profile_photo_url||null]);
    const s=r.rows[0];
    await query(`INSERT INTO student_profiles(student_id,application_no,admission_no,admission_year,batch,academic_year,degree,programme,date_of_birth,gender,nationality,religion,community,caste,blood_group,aadhaar_last4,nad_id,address,city,district,state,pincode,father_name,mother_name,parent_name,parent_phone,parent_email,emergency_contact_name,emergency_contact_phone,hosteller,hostel_name,hostel_room,transport_required,transport_route,faculty_advisor_id,program_id,photo_url,extra_details)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
      ON CONFLICT(student_id) DO UPDATE SET application_no=EXCLUDED.application_no,admission_no=EXCLUDED.admission_no,admission_year=EXCLUDED.admission_year,batch=EXCLUDED.batch,academic_year=EXCLUDED.academic_year,degree=EXCLUDED.degree,programme=EXCLUDED.programme,date_of_birth=EXCLUDED.date_of_birth,gender=EXCLUDED.gender,nationality=EXCLUDED.nationality,religion=EXCLUDED.religion,community=EXCLUDED.community,caste=EXCLUDED.caste,blood_group=EXCLUDED.blood_group,aadhaar_last4=EXCLUDED.aadhaar_last4,nad_id=EXCLUDED.nad_id,address=EXCLUDED.address,city=EXCLUDED.city,district=EXCLUDED.district,state=EXCLUDED.state,pincode=EXCLUDED.pincode,father_name=EXCLUDED.father_name,mother_name=EXCLUDED.mother_name,parent_name=EXCLUDED.parent_name,parent_phone=EXCLUDED.parent_phone,parent_email=EXCLUDED.parent_email,emergency_contact_name=EXCLUDED.emergency_contact_name,emergency_contact_phone=EXCLUDED.emergency_contact_phone,hosteller=EXCLUDED.hosteller,hostel_name=EXCLUDED.hostel_name,hostel_room=EXCLUDED.hostel_room,transport_required=EXCLUDED.transport_required,transport_route=EXCLUDED.transport_route,faculty_advisor_id=EXCLUDED.faculty_advisor_id,program_id=EXCLUDED.program_id,photo_url=EXCLUDED.photo_url,extra_details=EXCLUDED.extra_details,updated_at=NOW()`,
      [s.id,application_no||null,admission_no||null,admission_year??null,batch||null,academic_year||null,degree||null,programme||null,date_of_birth||null,gender||null,nationality||null,religion||null,community||null,caste||null,blood_group||null,aadhaar_last4||null,nad_id||null,address||null,city||null,district||null,state||null,pincode||null,father_name||null,mother_name||null,parent_name||null,parent_phone||null,parent_email||null,emergency_contact_name||null,emergency_contact_phone||null,Boolean(hosteller),hostel_name||null,hostel_room||null,Boolean(transport_required),transport_route||null,faculty_advisor_id||null,program_id||null,profile_photo_url||null,extra_details||{}]);
    res.status(201).json({student:{...s,name:s.full_name}});
  }catch(err){console.error('Admin student creation failed:',err.message);if(err.code==='23505')return res.status(409).json({error:'Register number or email is already in use'});res.status(503).json({error:'Unable to create student'});}
});

app.patch('/api/admin/students/:id', auth, requireRole('admin'), async (req,res)=>{
  try{
    const body=req.body||{};
    const fields=['full_name','email','department','semester','section','phone','profile_photo_url'];
    if(!body.full_name||!String(body.full_name).trim())return res.status(400).json({error:'Full name is required'});
    if(String(body.aadhaar_last4||'').length>4)return res.status(400).json({error:'Aadhaar field accepts only the last 4 digits'});
    const r=await query(`UPDATE users SET full_name=$1,email=$2,department=$3,semester=$4,section=$5,phone=$6,profile_photo_url=$7,updated_at=NOW()
      WHERE id=$8 AND role='student' RETURNING id,register_no,full_name,email,role,department,semester,section,phone,profile_photo_url,is_active,account_status`,
      [String(body.full_name).trim(),body.email||null,body.department||null,body.semester||null,body.section||null,body.phone||null,body.profile_photo_url||null,req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Student not found'});
    const p={...body};
    await query(`INSERT INTO student_profiles(student_id,application_no,admission_no,admission_year,batch,academic_year,degree,programme,date_of_birth,gender,nationality,religion,community,caste,blood_group,aadhaar_last4,nad_id,address,city,district,state,pincode,father_name,mother_name,parent_name,parent_phone,parent_email,emergency_contact_name,emergency_contact_phone,hosteller,hostel_name,hostel_room,transport_required,transport_route,faculty_advisor_id,program_id,photo_url,extra_details)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
      ON CONFLICT(student_id) DO UPDATE SET application_no=EXCLUDED.application_no,admission_no=EXCLUDED.admission_no,admission_year=EXCLUDED.admission_year,batch=EXCLUDED.batch,academic_year=EXCLUDED.academic_year,degree=EXCLUDED.degree,programme=EXCLUDED.programme,date_of_birth=EXCLUDED.date_of_birth,gender=EXCLUDED.gender,nationality=EXCLUDED.nationality,religion=EXCLUDED.religion,community=EXCLUDED.community,caste=EXCLUDED.caste,blood_group=EXCLUDED.blood_group,aadhaar_last4=EXCLUDED.aadhaar_last4,nad_id=EXCLUDED.nad_id,address=EXCLUDED.address,city=EXCLUDED.city,district=EXCLUDED.district,state=EXCLUDED.state,pincode=EXCLUDED.pincode,father_name=EXCLUDED.father_name,mother_name=EXCLUDED.mother_name,parent_name=EXCLUDED.parent_name,parent_phone=EXCLUDED.parent_phone,parent_email=EXCLUDED.parent_email,emergency_contact_name=EXCLUDED.emergency_contact_name,emergency_contact_phone=EXCLUDED.emergency_contact_phone,hosteller=EXCLUDED.hosteller,hostel_name=EXCLUDED.hostel_name,hostel_room=EXCLUDED.hostel_room,transport_required=EXCLUDED.transport_required,transport_route=EXCLUDED.transport_route,faculty_advisor_id=EXCLUDED.faculty_advisor_id,program_id=EXCLUDED.program_id,photo_url=EXCLUDED.photo_url,extra_details=EXCLUDED.extra_details,updated_at=NOW()`,
      [req.params.id,p.application_no||null,p.admission_no||null,p.admission_year??null,p.batch||null,p.academic_year||null,p.degree||null,p.programme||null,p.date_of_birth||null,p.gender||null,p.nationality||null,p.religion||null,p.community||null,p.caste||null,p.blood_group||null,p.aadhaar_last4||null,p.nad_id||null,p.address||null,p.city||null,p.district||null,p.state||null,p.pincode||null,p.father_name||null,p.mother_name||null,p.parent_name||null,p.parent_phone||null,p.parent_email||null,p.emergency_contact_name||null,p.emergency_contact_phone||null,Boolean(p.hosteller),p.hostel_name||null,p.hostel_room||null,Boolean(p.transport_required),p.transport_route||null,p.faculty_advisor_id||null,p.program_id||null,p.profile_photo_url||null,p.extra_details||{}]);
    res.json({student:{...r.rows[0],name:r.rows[0].full_name}});
  }catch(err){console.error(err);if(err.code==='23505')return res.status(409).json({error:'Email is already in use'});res.status(503).json({error:'Unable to update student'});}
});

app.get('/api/subjects', auth, async (_req, res) => { try { const r = await query(`SELECT id,code,name,department,semester FROM subjects ORDER BY code`); res.json({ subjects: r.rows }); } catch (_err) { res.status(503).json({ error: 'Database unavailable' }); } });
app.post('/api/subjects', auth, requireRole('admin'), async (req, res) => { try { const { code, name, department, semester } = req.body || {}; if (!code || !name) return res.status(400).json({ error: 'code and name are required' }); const r = await query(`INSERT INTO subjects(code,name,department,semester) VALUES($1,$2,$3,$4) RETURNING id,code,name,department,semester`, [code,name,department||null,semester||null]); res.status(201).json({ subject: r.rows[0] }); } catch (err) { res.status(err.code === '23505' ? 409 : 503).json({ error: err.code === '23505' ? 'Subject code already exists' : 'Unable to create subject' }); } });
app.post('/api/attendance/sessions', auth, requireRole('faculty'), async (req, res) => { try { const { subjectId, section, room, durationSeconds=60 } = req.body || {}; if (!subjectId) return res.status(400).json({ error: 'subjectId is required' }); const token = crypto.randomBytes(32).toString('base64url'); const seconds = Math.max(15, Math.min(Number(durationSeconds) || 60, 300)); const expiresAt = new Date(Date.now() + seconds * 1000); const r = await query(`INSERT INTO attendance_sessions(faculty_id,subject_id,section,room,qr_token_hash,qr_expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,subject_id,section,room,qr_expires_at,status,started_at`, [req.user.sub,subjectId,section||null,room||null,hashToken(token),expiresAt]); res.status(201).json({ session:r.rows[0], qrToken:token }); } catch (err) { console.error(err); res.status(503).json({ error:'Unable to start attendance session' }); } });
app.get('/api/attendance/sessions/:id', auth, async (req, res) => { try { const r = await query(`SELECT s.id,s.subject_id,s.section,s.room,s.qr_expires_at,s.status,s.started_at,sub.code,sub.name,(SELECT COUNT(*)::int FROM attendance_records a WHERE a.session_id=s.id) AS present_count FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE s.id=$1`, [req.params.id]); if (!r.rows[0]) return res.status(404).json({ error:'Session not found' }); res.json({ session:r.rows[0] }); } catch (_err) { res.status(503).json({ error:'Database unavailable' }); } });
app.post('/api/attendance/scan', auth, requireRole('student'), async (req, res) => { try { const { qrToken } = req.body || {}; if (!qrToken) return res.status(400).json({ error:'qrToken is required' }); const s = await query(`SELECT id FROM attendance_sessions WHERE qr_token_hash=$1 AND status='open' AND qr_expires_at>NOW() LIMIT 1`, [hashToken(qrToken)]); if (!s.rows[0]) return res.status(400).json({ error:'QR expired, closed or invalid' }); const r = await query(`INSERT INTO attendance_records(session_id,student_id,method) VALUES($1,$2,'qr') ON CONFLICT(session_id,student_id) DO NOTHING RETURNING id,marked_at,status`, [s.rows[0].id,req.user.sub]); if (!r.rows[0]) return res.status(409).json({ error:'Attendance already marked for this session' }); res.status(201).json({ message:'Attendance marked', attendance:r.rows[0] }); } catch (_err) { res.status(503).json({ error:'Attendance service unavailable' }); } });
app.get('/api/attendance/sessions/:id/records', auth, requireRole('faculty','admin'), async (req, res) => { try { const r = await query(`SELECT a.id,a.marked_at,a.status,u.register_no,u.full_name FROM attendance_records a JOIN users u ON u.id=a.student_id WHERE a.session_id=$1 ORDER BY a.marked_at`, [req.params.id]); res.json({ records:r.rows }); } catch (_err) { res.status(503).json({ error:'Database unavailable' }); } });
app.post('/api/attendance/sessions/:id/close', auth, requireRole('faculty'), async (req, res) => { try { const r = await query(`UPDATE attendance_sessions SET status='closed',closed_at=NOW() WHERE id=$1 AND faculty_id=$2 RETURNING id,status,closed_at`, [req.params.id,req.user.sub]); if (!r.rows[0]) return res.status(404).json({ error:'Session not found' }); res.json({ session:r.rows[0] }); } catch (_err) { res.status(503).json({ error:'Unable to close session' }); } });


function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => Number(v) * Math.PI / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function listRows(res, sql, params, key) {
  try { const r = await query(sql, params || []); return res.json({ [key]: r.rows }); }
  catch (err) { console.error(err); return res.status(503).json({ error:'Database unavailable' }); }
}

/* Complete SIS read APIs */
app.get('/api/sis/student/overview', auth, requireRole('student'), async (req,res) => {
  if (req.user.demo) {
    const d=DEMO_USERS[req.user.sub];
    if(!d || d.role!=='student') return res.status(404).json({error:'Student not found'});
    return res.json({student:{...d,password:undefined,student_profile:d.student_profile||{}},attendance:{total:0,present:0,percentage:0},notifications:[],timetable:[],grades:[],fees:[],leaves:[]});
  }
  try {
    const [u,a,n,t,g,fees,l] = await Promise.all([
      query(`SELECT u.id,u.register_no,u.full_name,u.email,u.department,u.semester,u.section,u.phone,u.profile_photo_url,u.account_status,
        sp.*,fa.full_name AS faculty_advisor_name
        FROM users u LEFT JOIN student_profiles sp ON sp.student_id=u.id
        LEFT JOIN users fa ON fa.id=sp.faculty_advisor_id WHERE u.id=$1`,[req.user.sub]),
      query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='present')::int present FROM attendance_records WHERE student_id=$1`,[req.user.sub]),
      query(`SELECT n.id,n.title,n.message,n.created_at,n.expires_at,nr.read_at FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=$1
        WHERE (n.audience_role IS NULL OR n.audience_role='student') AND (n.department IS NULL OR n.department=(SELECT department FROM users WHERE id=$1)) ORDER BY n.created_at DESC LIMIT 20`,[req.user.sub]),
      query(`SELECT t.id,t.day_of_week,t.start_time,t.end_time,t.room,s.code,s.name FROM timetables t JOIN course_offerings o ON o.id=t.offering_id JOIN subjects s ON s.id=o.subject_id
        WHERE o.section=(SELECT section FROM users WHERE id=$1) AND o.semester=(SELECT semester FROM users WHERE id=$1) AND o.active=true ORDER BY t.day_of_week,t.start_time`,[req.user.sub]),
      query(`SELECT g.id,g.semester,g.academic_year,g.grade,g.grade_point,g.credits,s.code,s.name FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE g.student_id=$1 AND g.published=true ORDER BY g.academic_year DESC,g.semester,s.code`,[req.user.sub]),
      query(`SELECT id,academic_year,fee_type,amount,paid_amount,due_date,status FROM fee_accounts WHERE student_id=$1 ORDER BY due_date DESC NULLS LAST`,[req.user.sub]),
      query(`SELECT id,from_date,to_date,reason,status,reviewer_note,created_at FROM leave_requests WHERE student_id=$1 ORDER BY created_at DESC`,[req.user.sub])
    ]);
    const total=a.rows[0]?.total||0, present=a.rows[0]?.present||0;
    res.json({student:u.rows[0],attendance:{total,present,percentage:total?Math.round(present*10000/total)/100:0},notifications:n.rows,timetable:t.rows,grades:g.rows,fees:fees.rows,leaves:l.rows});
  } catch(err){ console.error(err); res.status(503).json({error:'Student SIS unavailable'}); }
});

app.get('/api/sis/student/:resource', auth, requireRole('student'), async (req,res) => {
  const allowed = {
    notifications:[`SELECT n.*,nr.read_at FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=$1 WHERE (n.audience_role IS NULL OR n.audience_role='student') ORDER BY n.created_at DESC`,'rows'],
    grades:[`SELECT g.*,s.code,s.name FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE g.student_id=$1 AND g.published=true ORDER BY g.academic_year DESC,g.semester`,'rows'],
    timetable:[`SELECT t.*,s.code,s.name,o.section,o.semester FROM timetables t JOIN course_offerings o ON o.id=t.offering_id JOIN subjects s ON s.id=o.subject_id WHERE o.section=(SELECT section FROM users WHERE id=$1) ORDER BY t.day_of_week,t.start_time`,'rows'],
    fees:[`SELECT * FROM fee_accounts WHERE student_id=$1 ORDER BY due_date DESC NULLS LAST`,'rows'],
    leaves:[`SELECT * FROM leave_requests WHERE student_id=$1 ORDER BY created_at DESC`,'rows'],
    grievances:[`SELECT * FROM grievances WHERE student_id=$1 ORDER BY created_at DESC`,'rows'],
    registrations:[`SELECT cr.id,cr.status,cr.registered_at,cr.semester,cr.academic_year,s.code,s.name,s.credits FROM course_registrations cr JOIN subjects s ON s.id=cr.subject_id WHERE cr.student_id=$1 ORDER BY cr.academic_year DESC,cr.semester,s.code`,'rows'],
    semester:[`SELECT register_no,full_name,department,semester,section,account_status FROM users WHERE id=$1 AND role='student'`,'rows']
  };
  if (!allowed[req.params.resource]) return res.status(404).json({error:'Unknown SIS resource'});
  if (req.user.demo) return res.json({[allowed[req.params.resource][1]]:[]});
  return listRows(res,allowed[req.params.resource][0],[req.user.sub],allowed[req.params.resource][1]);
});

app.post('/api/sis/student/grievances', auth, requireRole('student'), async (req,res)=>{
  try { const {category,subject,description}=req.body||{}; if(!category||!subject||!description)return res.status(400).json({error:'category, subject and description are required'});
    const r=await query(`INSERT INTO grievances(student_id,category,subject,description) VALUES($1,$2,$3,$4) RETURNING *`,[req.user.sub,category,subject,description]);
    res.status(201).json({grievance:r.rows[0]});
  } catch(_e){res.status(503).json({error:'Unable to submit grievance'});}
});

app.post('/api/sis/student/leaves', auth, requireRole('student'), async (req,res)=>{
  try { const {from_date,to_date,reason}=req.body||{}; if(!from_date||!to_date||!reason)return res.status(400).json({error:'from_date, to_date and reason are required'});
    const r=await query(`INSERT INTO leave_requests(student_id,from_date,to_date,reason) VALUES($1,$2,$3,$4) RETURNING *`,[req.user.sub,from_date,to_date,reason]);
    res.status(201).json({leave:r.rows[0]});
  } catch(_e){res.status(503).json({error:'Unable to submit leave request'});}
});

/* Faculty SIS APIs */
app.get('/api/sis/faculty/overview', auth, requireRole('faculty'), async (req,res)=>{
  try {
    // Resolve both real UUID sessions and demo faculty IDs (FAC001...FAC005).
    let facultyId=String(req.user.sub);
    if(req.user.demo){
      const demo=DEMO_USERS[req.user.sub];
      if(!demo || demo.role!=='faculty') return res.status(404).json({error:'Faculty not found'});
      facultyId=demo.employee_id;
    }
    const isUuid=/^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(facultyId);
    const userResult=isUuid
      ? await query(`SELECT id,employee_id,full_name,email,department,designation,phone,profile_photo_url
          FROM users WHERE id=$1::uuid AND role='faculty' AND is_active=true LIMIT 1`,[facultyId])
      : await query(`SELECT id,employee_id,full_name,email,department,designation,phone,profile_photo_url
          FROM users WHERE employee_id=$1 AND role='faculty' AND is_active=true LIMIT 1`,[facultyId]);
    if(!userResult.rows[0]) return res.status(404).json({error:'Faculty account is not available in the database'});
    const faculty=userResult.rows[0];
    const [studentResult, offeringResult, sessionResult]=await Promise.all([
      query(`SELECT COUNT(*)::int count FROM users WHERE role='student' AND is_active=true AND (department=$1 OR $1 IS NULL)`,[faculty.department||null]),
      query(`SELECT DISTINCT o.id AS offering_id,s.id,s.code,s.name,s.department,o.semester,o.section,o.academic_year,o.room
        FROM course_offerings o JOIN subjects s ON s.id=o.subject_id
        WHERE o.faculty_id=$1 AND o.active=true
        ORDER BY o.semester::int,s.code,o.section`,[faculty.id]),
      query(`SELECT id,subject_id,section,room,status,started_at,qr_expires_at
        FROM attendance_sessions WHERE faculty_id=$1 AND status='open' ORDER BY started_at DESC`,[faculty.id])
    ]);
    return res.json({
      faculty,
      students:studentResult.rows[0]?.count||0,
      subjects:offeringResult.rows,
      openSessions:sessionResult.rows
    });
  } catch(err) {
    console.error('Faculty SIS overview failed:',err.code||err.message);
    return res.status(503).json({error:'Faculty SIS unavailable'});
  }
});
app.get('/api/sis/faculty/classes', auth, requireRole('faculty'), async (req,res)=>listRows(res,`SELECT o.id,o.section,o.semester,o.academic_year,o.room,s.id subject_id,s.code,s.name,t.day_of_week,t.start_time,t.end_time FROM course_offerings o JOIN subjects s ON s.id=o.subject_id LEFT JOIN timetables t ON t.offering_id=o.id WHERE o.faculty_id=$1 AND o.active=true ORDER BY t.day_of_week,t.start_time`,[req.user.sub],'classes'));

app.get('/api/sis/faculty/reports/attendance', auth, requireRole('faculty','admin'), async (req,res)=>listRows(res,`SELECT s.id session_id,s.started_at,s.section,s.room,sub.code,sub.name,COUNT(a.id)::int present_count FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id LEFT JOIN attendance_records a ON a.session_id=s.id WHERE s.faculty_id=$1 GROUP BY s.id,sub.code,sub.name ORDER BY s.started_at DESC LIMIT 200`,[req.user.sub],'reports'));

app.get('/api/sis/faculty/attendance/live', auth, requireRole('faculty'), async (req,res)=>{
  try {
    const sessions=await query(`SELECT s.id,s.subject_id,s.section,s.room,s.status,s.started_at,s.qr_expires_at,s.latitude,s.longitude,s.allowed_radius_meters,
      sub.code AS subject_code,sub.name AS subject_name,
      (SELECT COUNT(*)::int FROM attendance_records a WHERE a.session_id=s.id) AS present_count,
      (SELECT COUNT(*)::int FROM attendance_security_events e WHERE e.session_id=s.id) AS security_event_count,
      (SELECT COUNT(*)::int FROM users u WHERE u.role='student' AND u.is_active=true AND (s.section IS NULL OR lower(trim(u.section))=lower(trim(s.section)))) AS expected_count
      FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id
      WHERE s.faculty_id=$1 AND s.status='open' ORDER BY s.started_at DESC`,[req.user.sub]);
    const ids=sessions.rows.map(x=>x.id);
    let records=[],events=[];
    if(ids.length){
      records=(await query(`SELECT a.id,a.session_id,a.marked_at,a.status,a.distance_meters,a.verification_method,a.liveness_status,a.face_match_status,a.risk_score,u.register_no,u.full_name,u.section
        FROM attendance_records a JOIN users u ON u.id=a.student_id WHERE a.session_id=ANY($1::uuid[]) ORDER BY a.marked_at DESC`,[ids])).rows;
      events=(await query(`SELECT id,session_id,event_type,distance_meters,risk_score,metadata,created_at FROM attendance_security_events WHERE session_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 200`,[ids])).rows;
    }
    const bySession=Object.fromEntries(sessions.rows.map(s=>[s.id,{...s,records:[],security_events:[]} ]));
    records.forEach(r=>bySession[r.session_id]?.records.push(r));
    events.forEach(e=>bySession[e.session_id]?.security_events.push(e));
    res.json({sessions:Object.values(bySession)});
  } catch(err){console.error('Live attendance failed:',err.message);res.status(503).json({error:'Live attendance service unavailable'});}
});

app.post('/api/sis/faculty/attendance/sessions', auth, requireRole('faculty'), async (req,res)=>{
  try {
    const b=req.body||{};
    const subjectId=b.subjectId||b.subject_id;
    const section=String(b.section||'').trim()||null;
    const room=String(b.room||'').trim()||null;
    const latitude=b.latitude===''||b.latitude==null?null:Number(b.latitude);
    const longitude=b.longitude===''||b.longitude==null?null:Number(b.longitude);
    const allowedRadiusMeters=Math.max(10,Math.min(Number(b.allowedRadiusMeters??b.allowed_radius_meters)||100,5000));
    const minutes=Math.max(1,Math.min(Number(b.qrExpiresMinutes??b.qr_expires_minutes)||5,30));
    if(!subjectId)return res.status(400).json({error:'subjectId is required'});
    if((latitude===null)!==(longitude===null))return res.status(400).json({error:'Latitude and longitude must be provided together'});
    if(latitude!==null&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180))return res.status(400).json({error:'Invalid faculty location'});
    const offering=await query(`SELECT o.id,o.subject_id,o.faculty_id,o.semester,o.section,o.academic_year,o.room,s.code,s.name
      FROM course_offerings o JOIN subjects s ON s.id=o.subject_id
      WHERE o.id=$1 AND o.faculty_id=$2 AND o.active=true LIMIT 1`,[subjectId,req.user.sub]);
    let selectedOffering=offering.rows[0];
    // Backward-compatible subject selection: if the client sends a subject id, choose the
    // current active offering for this faculty and use its semester/section defaults.
    if(!selectedOffering){
      const fallback=await query(`SELECT o.id,o.subject_id,o.faculty_id,o.semester,o.section,o.academic_year,o.room,s.code,s.name
        FROM course_offerings o JOIN subjects s ON s.id=o.subject_id
        WHERE o.subject_id=$1 AND o.faculty_id=$2 AND o.active=true
        ORDER BY o.semester::int,o.section LIMIT 1`,[subjectId,req.user.sub]);
      selectedOffering=fallback.rows[0];
    }
    if(!selectedOffering)return res.status(403).json({error:'This subject is not assigned to your faculty account.'});
    const finalSection=section||selectedOffering.section||null;
    if(section && selectedOffering.section && section.toLowerCase()!==String(selectedOffering.section).toLowerCase())return res.status(403).json({error:'Selected section does not match your assigned course offering.'});
    const finalSemester=selectedOffering.semester;
    const finalAcademicYear=selectedOffering.academic_year;
    const finalRoom=room||selectedOffering.room||null;
    const token=crypto.randomBytes(32).toString('base64url');
    const exp=new Date(Date.now()+minutes*60*1000);
    const r=await query(`INSERT INTO attendance_sessions(faculty_id,subject_id,offering_id,semester,academic_year,section,room,qr_token_hash,qr_expires_at,latitude,longitude,allowed_radius_meters)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,subject_id,offering_id,semester,academic_year,section,room,qr_expires_at,status,started_at,latitude,longitude,allowed_radius_meters`,
      [req.user.sub,selectedOffering.subject_id,selectedOffering.id,finalSemester,finalAcademicYear,finalSection,finalRoom,hashToken(token),exp,latitude,longitude,allowedRadiusMeters]);
    const session={...r.rows[0],subject_code:selectedOffering.code,subject_name:selectedOffering.name,qr_token:token};
    res.status(201).json({session,qrToken:token});
  } catch(err){console.error(err);res.status(503).json({error:'Unable to start secure attendance'});}
});

app.post('/api/sis/attendance/verify', auth, requireRole('student'), async (req,res)=>{
  try {
    const {qrToken,latitude,longitude,deviceFingerprint,faceMatchStatus='not_checked',livenessStatus='not_checked'}=req.body||{};
    if(!qrToken)return res.status(400).json({error:'qrToken is required'});
    const s=await query(`SELECT id,offering_id,semester,academic_year,section,latitude,longitude,allowed_radius_meters FROM attendance_sessions WHERE qr_token_hash=$1 AND status='open' AND qr_expires_at>NOW() LIMIT 1`,[hashToken(qrToken)]);
    if(!s.rows[0])return res.status(400).json({error:'QR expired, closed or invalid'});
    const session=s.rows[0];
    const student=await query("SELECT section FROM users WHERE id=$1 AND role='student' AND is_active=true",[req.user.sub]);
    if(!student.rows[0])return res.status(404).json({error:'Student account not found'});
    if(session.section && String(student.rows[0].section||'').trim().toLowerCase()!==String(session.section).trim().toLowerCase()){
      await query(`INSERT INTO attendance_security_events(session_id,student_id,event_type,risk_score,metadata) VALUES($1,$2,'section_mismatch',85,$3)`,[session.id,req.user.sub,JSON.stringify({studentSection:student.rows[0].section||null,sessionSection:session.section})]);
      return res.status(403).json({error:'This attendance session is restricted to section '+session.section});
    }
    let distance=null;
    if(session.latitude!=null&&session.longitude!=null&&latitude!=null&&longitude!=null) distance=haversineMeters(session.latitude,session.longitude,latitude,longitude);
    if(distance!=null&&session.allowed_radius_meters!=null&&distance>Number(session.allowed_radius_meters)){
      await query(`INSERT INTO attendance_security_events(session_id,student_id,event_type,device_fingerprint_hash,latitude,longitude,distance_meters,risk_score) VALUES($1,$2,'gps_outside_radius',$3,$4,$5,$6,90)`,[session.id,req.user.sub,deviceFingerprint?hashToken(deviceFingerprint):null,latitude,longitude,distance]);
      return res.status(403).json({error:'You are outside the allowed attendance radius',distanceMeters:Math.round(distance)});
    }
    const deviceHash=deviceFingerprint?hashToken(deviceFingerprint):null;
    if(deviceHash){
      const conflict=await query(`SELECT student_id FROM attendance_records WHERE session_id=$1 AND device_fingerprint_hash=$2 AND student_id<>$3 LIMIT 1`,[session.id,deviceHash,req.user.sub]);
      if(conflict.rows[0]){
        await query(`INSERT INTO attendance_security_events(session_id,student_id,event_type,device_fingerprint_hash,risk_score,metadata) VALUES($1,$2,'device_multiple_students',$3,100,$4)`,[session.id,req.user.sub,deviceHash,JSON.stringify({otherStudent:conflict.rows[0].student_id})]);
        return res.status(409).json({error:'This device has already been used for another student in this attendance session'});
      }
    }
    if(faceMatchStatus==='failed'||livenessStatus==='failed') return res.status(403).json({error:'Identity/liveness verification failed'});
    const risk=(faceMatchStatus==='matched'?0:20)+(livenessStatus==='live'?0:20);
    const r=await query(`INSERT INTO attendance_records(session_id,student_id,method,latitude,longitude,distance_meters,device_fingerprint_hash,verification_method,liveness_status,face_match_status,risk_score)
      VALUES($1,$2,'qr_secure',$3,$4,$5,$6,'qr+gps+identity',$7,$8,$9) ON CONFLICT(session_id,student_id) DO NOTHING RETURNING id,marked_at,status`,
      [session.id,req.user.sub,latitude??null,longitude??null,distance,deviceHash,livenessStatus,faceMatchStatus,risk]);
    if(!r.rows[0])return res.status(409).json({error:'Attendance already marked for this session'});
    res.status(201).json({message:'Attendance verified and marked',attendance:r.rows[0],distanceMeters:distance==null?null:Math.round(distance),riskScore:risk});
  } catch(err){console.error(err);res.status(503).json({error:'Secure attendance service unavailable'});}
});

/* Admin SIS APIs */
app.get('/api/sis/admin/overview', auth, requireRole('admin'), async (req,res)=>{
  if(req.user.demo)return res.json({counts:{students:1,faculty:1,admins:1,subjects:0,departments:0},recentAudit:[]});
  try {
    const r=await query(`SELECT role,COUNT(*)::int count FROM users WHERE is_active=true GROUP BY role`);
    const subjects=await query('SELECT COUNT(*)::int count FROM subjects');
    const departments=await query('SELECT COUNT(*)::int count FROM departments');
    const audit=await query(`SELECT a.id,a.action,a.entity_type,a.created_at,u.full_name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 30`);
    res.json({counts:{...Object.fromEntries(r.rows.map(x=>[x.role,x.count])),subjects:subjects.rows[0].count,departments:departments.rows[0].count},recentAudit:audit.rows});
  }catch(_e){res.status(503).json({error:'Admin SIS unavailable'});}
});

app.get('/api/sis/admin/timetable',auth,requireRole('admin'),async(req,res)=>listRows(res,`
  SELECT o.id,o.section,o.semester,o.academic_year,o.room,s.code,s.name,
         u.full_name AS faculty_name,t.day_of_week,t.start_time,t.end_time
  FROM course_offerings o
  JOIN subjects s ON s.id=o.subject_id
  LEFT JOIN users u ON u.id=o.faculty_id
  LEFT JOIN timetables t ON t.offering_id=o.id
  WHERE o.active=true
  ORDER BY o.academic_year DESC,o.semester,o.section,t.day_of_week,t.start_time
`,[],'timetable'));
app.get('/api/sis/admin/departments',auth,requireRole('admin'),async(req,res)=>listRows(res,'SELECT * FROM departments ORDER BY code',[],'departments'));
app.post('/api/sis/admin/departments',auth,requireRole('admin'),async(req,res)=>{
  try{const {code,name,hod_id}=req.body||{};if(!code||!name)return res.status(400).json({error:'code and name are required'});const r=await query('INSERT INTO departments(code,name,hod_id) VALUES($1,$2,$3) RETURNING *',[code,name,hod_id||null]);res.status(201).json({department:r.rows[0]});}catch(err){res.status(err.code==='23505'?409:503).json({error:err.code==='23505'?'Department code already exists':'Unable to create department'});}
});
app.get('/api/sis/admin/audit-logs',auth,requireRole('admin'),async(req,res)=>listRows(res,'SELECT a.*,u.full_name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500',[],'logs'));


app.use((_req,res) => res.status(404).json({ error:'Route not found' }));

async function start() {
  try { await initDb(); } catch (err) { console.warn('Startup database initialization failed; API will remain available:', err.message); }
  app.listen(PORT,'0.0.0.0',() => console.log(`KARE ONE API running on ${PORT}`));
}
start();
