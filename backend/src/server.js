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
  student: { id: 'demo-student', register_no: 'student', employee_id: null, full_name: 'Demo Student', email: 'student@kare.edu', role: 'student', department: 'Demo Department', semester: 1, section: 'A', password: 'student' },
  faculty: { id: 'demo-faculty', register_no: null, employee_id: 'FAC001', full_name: 'Dr. Demo Faculty', email: 'faculty@kare.edu', role: 'faculty', department: 'Computer Science and Engineering', semester: null, section: null, phone: '+91 90000 00001', designation: 'Assistant Professor', password: 'faculty', login_aliases: ['faculty'] },
  admin: { id: 'demo-admin', register_no: null, employee_id: 'admin', full_name: 'Demo Administrator', email: 'admin@kare.edu', role: 'admin', department: null, semester: null, section: null, password: 'admin' }
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
      const result = await query(`SELECT id, register_no, employee_id, full_name, email, password_hash, role, department, semester, section, phone, designation, profile_photo_url FROM users WHERE is_active=true AND role=$1 AND (register_no=$2 OR employee_id=$2 OR lower(email)=lower($2)) LIMIT 1`, [role, identifier]);
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
    const r = await query(`SELECT id,register_no,employee_id,full_name,email,role,department,semester,section,phone,designation,profile_photo_url FROM users WHERE id=$1 AND is_active=true`, [req.user.sub]);
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
    const r = await query(`SELECT id,employee_id,full_name,email,department,designation,phone,profile_photo_url,is_active,created_at
      FROM users WHERE role='faculty' AND is_active=true ORDER BY employee_id,full_name`);
    return res.json({ faculty: r.rows.map(u => ({ ...u, name: u.full_name })) });
  } catch (_err) { return res.status(503).json({ error: 'Faculty service unavailable' }); }
});

app.post('/api/admin/faculty', auth, requireRole('admin'), async (req, res) => {
  try {
    const { employee_id, password, full_name, email, department, designation, phone, profile_photo_url } = req.body || {};
    if (!employee_id || !password || !full_name) return res.status(400).json({ error: 'Employee ID, password and full name are required' });
    if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (String(profile_photo_url || '').length > 700000) return res.status(400).json({ error: 'Profile photo is too large' });
    if (req.user.demo) {
      const key = String(employee_id).trim().toLowerCase();
      const exists = Object.values(DEMO_USERS).find(u => u.role === 'faculty' && [u.employee_id,u.email].filter(Boolean).map(v=>String(v).toLowerCase()).includes(key));
      if (exists) return res.status(409).json({ error: 'Faculty employee ID or email already exists' });
      const id = 'demo-faculty-' + crypto.randomBytes(5).toString('hex');
      DEMO_USERS[id] = { id, register_no:null, employee_id:String(employee_id).trim(), full_name:String(full_name).trim(), email:email?String(email).trim():null, role:'faculty', department:department||null, semester:null, section:null, phone:phone||null, designation:designation||null, profile_photo_url:profile_photo_url||null, password:String(password) };
      const { password:_password, ...safe } = DEMO_USERS[id];
      return res.status(201).json({ faculty:{...safe,name:safe.full_name} });
    }
    const passwordHash = await bcrypt.hash(String(password), 12);
    const r = await query(`INSERT INTO users(employee_id,full_name,email,password_hash,role,department,designation,phone,profile_photo_url)
      VALUES($1,$2,$3,$4,'faculty',$5,$6,$7,$8)
      RETURNING id,employee_id,full_name,email,role,department,designation,phone,profile_photo_url,is_active,created_at`,
      [String(employee_id).trim(),String(full_name).trim(),email?String(email).trim():null,passwordHash,department||null,designation||null,phone||null,profile_photo_url||null]);
    return res.status(201).json({ faculty:{...r.rows[0],name:r.rows[0].full_name} });
  } catch(err) {
    if(err.code==='23505') return res.status(409).json({error:'Employee ID or email is already in use'});
    console.error('Faculty creation failed:',err.message);
    return res.status(503).json({error:'Unable to create faculty'});
  }
});

app.patch('/api/admin/faculty/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { full_name, email, department, designation, phone, profile_photo_url } = req.body || {};
    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: 'Full name is required' });
    if (String(profile_photo_url || '').length > 700000) return res.status(400).json({ error: 'Profile photo is too large' });

    if (req.user.demo) {
      const faculty = DEMO_USERS[req.params.id];
      if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ error: 'Faculty not found' });
      Object.assign(faculty, {
        full_name: String(full_name).trim(),
        email: email || null,
        department: department || null,
        designation: designation || null,
        phone: phone || null,
        profile_photo_url: profile_photo_url || null
      });
      const { password: _password, ...safe } = faculty;
      return res.json({ faculty: { ...safe, name: safe.full_name } });
    }

    const r = await query(`UPDATE users
      SET full_name=$1,email=$2,department=$3,designation=$4,phone=$5,profile_photo_url=$6,updated_at=NOW()
      WHERE id=$7 AND role='faculty' AND is_active=true
      RETURNING id,employee_id,full_name,email,role,department,designation,phone,profile_photo_url,is_active`,
      [String(full_name).trim(), email || null, department || null, designation || null, phone || null, profile_photo_url || null, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Faculty not found' });
    return res.json({ faculty: { ...r.rows[0], name: r.rows[0].full_name } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email is already in use' });
    return res.status(503).json({ error: 'Unable to update faculty' });
  }
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
  if (req.user.demo) return res.json({ student: { ...DEMO_USERS.student, password: undefined }, attendance:{total:0,present:0,percentage:0}, notifications:[], timetable:[], grades:[], fees:[], leaves:[] });
  try {
    const [u,a,n,t,g,fees,l] = await Promise.all([
      query(`SELECT u.id,u.register_no,u.full_name,u.email,u.department,u.semester,u.section,u.phone,sp.batch,sp.admission_year,sp.faculty_advisor_id
        FROM users u LEFT JOIN student_profiles sp ON sp.student_id=u.id WHERE u.id=$1`,[req.user.sub]),
      query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='present')::int present FROM attendance_records WHERE student_id=$1`,[req.user.sub]),
      query(`SELECT n.id,n.title,n.message,n.created_at,n.expires_at,nr.read_at FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=$1
        WHERE (n.audience_role IS NULL OR n.audience_role='student') AND (n.department IS NULL OR n.department=(SELECT department FROM users WHERE id=$1)) ORDER BY n.created_at DESC LIMIT 20`,[req.user.sub]),
      query(`SELECT t.id,t.day_of_week,t.start_time,t.end_time,t.room,s.code,s.name FROM timetables t JOIN course_offerings o ON o.id=t.offering_id JOIN subjects s ON s.id=o.subject_id
        JOIN users f ON f.id=o.faculty_id WHERE o.section=(SELECT section FROM users WHERE id=$1) AND o.semester=(SELECT semester FROM users WHERE id=$1) AND o.active=true ORDER BY t.day_of_week,t.start_time`,[req.user.sub]),
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
    grievances:[`SELECT * FROM grievances WHERE student_id=$1 ORDER BY created_at DESC`,'rows']
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
  if(req.user.demo)return res.json({faculty:DEMO_USERS.faculty,sessions:0,students:0,subjects:[],today:[],openSessions:[]});
  try {
    const [f,s,c,o]=await Promise.all([
      query(`SELECT id,employee_id,full_name,email,department,designation,phone,profile_photo_url FROM users WHERE id=$1`,[req.user.sub]),
      query(`SELECT COUNT(*)::int count FROM users WHERE role='student' AND is_active=true AND (department=$1 OR $1 IS NULL)`,[(await query('SELECT department FROM users WHERE id=$1',[req.user.sub])).rows[0]?.department||null]),
      query(`SELECT s.id,s.code,s.name,s.department,s.semester FROM faculty_subjects fs JOIN subjects s ON s.id=fs.subject_id WHERE fs.faculty_id=$1 ORDER BY s.code`,[req.user.sub]),
      query(`SELECT id,subject_id,section,room,status,started_at,qr_expires_at FROM attendance_sessions WHERE faculty_id=$1 AND status='open' ORDER BY started_at DESC`,[req.user.sub])
    ]);
    res.json({faculty:f.rows[0],students:s.rows[0]?.count||0,subjects:c.rows,openSessions:o.rows});
  } catch(_e){res.status(503).json({error:'Faculty SIS unavailable'});}
});

app.get('/api/sis/faculty/classes', auth, requireRole('faculty'), async (req,res)=>listRows(res,`SELECT o.id,o.section,o.semester,o.academic_year,o.room,s.id subject_id,s.code,s.name,t.day_of_week,t.start_time,t.end_time FROM course_offerings o JOIN subjects s ON s.id=o.subject_id LEFT JOIN timetables t ON t.offering_id=o.id WHERE o.faculty_id=$1 AND o.active=true ORDER BY t.day_of_week,t.start_time`,[req.user.sub],'classes'));

app.get('/api/sis/faculty/reports/attendance', auth, requireRole('faculty','admin'), async (req,res)=>listRows(res,`SELECT s.id session_id,s.started_at,s.section,s.room,sub.code,sub.name,COUNT(a.id)::int present_count FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id LEFT JOIN attendance_records a ON a.session_id=s.id WHERE s.faculty_id=$1 GROUP BY s.id,sub.code,sub.name ORDER BY s.started_at DESC LIMIT 200`,[req.user.sub],'reports'));

app.post('/api/sis/faculty/attendance/sessions', auth, requireRole('faculty'), async (req,res)=>{
  try {
    const {subjectId,section,room,durationSeconds=60,latitude,longitude,allowedRadiusMeters=100}=req.body||{};
    if(!subjectId)return res.status(400).json({error:'subjectId is required'});
    const token=crypto.randomBytes(32).toString('base64url');
    const seconds=Math.max(15,Math.min(Number(durationSeconds)||60,300));
    const exp=new Date(Date.now()+seconds*1000);
    const r=await query(`INSERT INTO attendance_sessions(faculty_id,subject_id,section,room,qr_token_hash,qr_expires_at,latitude,longitude,allowed_radius_meters)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,subject_id,section,room,qr_expires_at,status,started_at,latitude,longitude,allowed_radius_meters`,
      [req.user.sub,subjectId,section||null,room||null,hashToken(token),exp,latitude??null,longitude??null,allowedRadiusMeters??100]);
    res.status(201).json({session:r.rows[0],qrToken:token});
  } catch(err){console.error(err);res.status(503).json({error:'Unable to start secure attendance'});}
});

app.post('/api/sis/attendance/verify', auth, requireRole('student'), async (req,res)=>{
  try {
    const {qrToken,latitude,longitude,deviceFingerprint,faceMatchStatus='not_checked',livenessStatus='not_checked'}=req.body||{};
    if(!qrToken)return res.status(400).json({error:'qrToken is required'});
    const s=await query(`SELECT id,latitude,longitude,allowed_radius_meters FROM attendance_sessions WHERE qr_token_hash=$1 AND status='open' AND qr_expires_at>NOW() LIMIT 1`,[hashToken(qrToken)]);
    if(!s.rows[0])return res.status(400).json({error:'QR expired, closed or invalid'});
    const session=s.rows[0];
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
