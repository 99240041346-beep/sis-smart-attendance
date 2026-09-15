const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (process.env.DATABASE_URL) {
    try { await query('SELECT 1'); database = 'connected'; } catch (_err) { database = 'error'; }
  }
  res.json({ ok: true, service: 'KARE ONE API', phase: 1, database });
});

function auth(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET is not configured' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_err) { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Insufficient role' });
}

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET is not configured' });
    const { identifier, password, role } = req.body || {};
    if (!identifier || !password || !role) return res.status(400).json({ error: 'identifier, password and role are required' });
    const result = await query(
      `SELECT id, register_no, employee_id, full_name, email, password_hash, role, department, semester, section
       FROM users WHERE is_active=true AND role=$1
       AND (register_no=$2 OR employee_id=$2 OR lower(email)=lower($2)) LIMIT 1`, [role, identifier]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
    delete user.password_hash;
    res.json({ token, user: { ...user, name: user.full_name } });
  } catch (err) { console.error(err); res.status(503).json({ error: 'Authentication service unavailable' }); }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const r = await query(`SELECT id,register_no,employee_id,full_name,email,role,department,semester,section FROM users WHERE id=$1 AND is_active=true`, [req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...r.rows[0], name: r.rows[0].full_name } });
  } catch (_err) { res.status(503).json({ error: 'Database unavailable' }); }
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const r = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='present')::int AS present FROM attendance_records WHERE student_id=$1`, [req.user.sub]);
      return res.json({ role: 'student', attendance: r.rows[0] });
    }
    if (req.user.role === 'faculty') {
      const r = await query(`SELECT COUNT(*)::int AS sessions FROM attendance_sessions WHERE faculty_id=$1`, [req.user.sub]);
      return res.json({ role: 'faculty', sessions: r.rows[0].sessions });
    }
    const r = await query(`SELECT COUNT(*)::int AS users FROM users WHERE is_active=true`);
    res.json({ role: 'admin', users: r.rows[0].users });
  } catch (_err) { res.status(503).json({ error: 'Database unavailable' }); }
});

app.get('/api/subjects', auth, async (_req, res) => {
  try { const r = await query(`SELECT id,code,name,department,semester FROM subjects ORDER BY code`); res.json({ subjects: r.rows }); }
  catch (_err) { res.status(503).json({ error: 'Database unavailable' }); }
});

app.post('/api/subjects', auth, requireRole('admin'), async (req, res) => {
  try {
    const { code, name, department, semester } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const r = await query(`INSERT INTO subjects(code,name,department,semester) VALUES($1,$2,$3,$4) RETURNING id,code,name,department,semester`, [code,name,department||null,semester||null]);
    res.status(201).json({ subject: r.rows[0] });
  } catch (err) { res.status(err.code === '23505' ? 409 : 503).json({ error: err.code === '23505' ? 'Subject code already exists' : 'Unable to create subject' }); }
});

app.post('/api/attendance/sessions', auth, requireRole('faculty'), async (req, res) => {
  try {
    const { subjectId, section, room, durationSeconds=60 } = req.body || {};
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    const token = crypto.randomBytes(32).toString('base64url');
    const seconds = Math.max(15, Math.min(Number(durationSeconds) || 60, 300));
    const expiresAt = new Date(Date.now() + seconds * 1000);
    const r = await query(
      `INSERT INTO attendance_sessions(faculty_id,subject_id,section,room,qr_token_hash,qr_expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,subject_id,section,room,qr_expires_at,status,started_at`,
      [req.user.sub,subjectId,section||null,room||null,hashToken(token),expiresAt]
    );
    res.status(201).json({ session:r.rows[0], qrToken:token });
  } catch (err) { console.error(err); res.status(503).json({ error:'Unable to start attendance session' }); }
});

app.get('/api/attendance/sessions/:id', auth, async (req, res) => {
  try {
    const r = await query(
      `SELECT s.id,s.subject_id,s.section,s.room,s.qr_expires_at,s.status,s.started_at,sub.code,sub.name,
       (SELECT COUNT(*)::int FROM attendance_records a WHERE a.session_id=s.id) AS present_count
       FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE s.id=$1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error:'Session not found' });
    res.json({ session:r.rows[0] });
  } catch (_err) { res.status(503).json({ error:'Database unavailable' }); }
});

app.post('/api/attendance/scan', auth, requireRole('student'), async (req, res) => {
  try {
    const { qrToken } = req.body || {};
    if (!qrToken) return res.status(400).json({ error:'qrToken is required' });
    const s = await query(`SELECT id FROM attendance_sessions WHERE qr_token_hash=$1 AND status='open' AND qr_expires_at>NOW() LIMIT 1`, [hashToken(qrToken)]);
    if (!s.rows[0]) return res.status(400).json({ error:'QR expired, closed or invalid' });
    const r = await query(`INSERT INTO attendance_records(session_id,student_id,method) VALUES($1,$2,'qr') ON CONFLICT(session_id,student_id) DO NOTHING RETURNING id,marked_at,status`, [s.rows[0].id,req.user.sub]);
    if (!r.rows[0]) return res.status(409).json({ error:'Attendance already marked for this session' });
    res.status(201).json({ message:'Attendance marked', attendance:r.rows[0] });
  } catch (_err) { res.status(503).json({ error:'Attendance service unavailable' }); }
});

app.get('/api/attendance/sessions/:id/records', auth, requireRole('faculty','admin'), async (req, res) => {
  try {
    const r = await query(`SELECT a.id,a.marked_at,a.status,u.register_no,u.full_name FROM attendance_records a JOIN users u ON u.id=a.student_id WHERE a.session_id=$1 ORDER BY a.marked_at`, [req.params.id]);
    res.json({ records:r.rows });
  } catch (_err) { res.status(503).json({ error:'Database unavailable' }); }
});

app.post('/api/attendance/sessions/:id/close', auth, requireRole('faculty'), async (req, res) => {
  try {
    const r = await query(`UPDATE attendance_sessions SET status='closed',closed_at=NOW() WHERE id=$1 AND faculty_id=$2 RETURNING id,status,closed_at`, [req.params.id,req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error:'Session not found' });
    res.json({ session:r.rows[0] });
  } catch (_err) { res.status(503).json({ error:'Unable to close session' }); }
});

app.use((_req,res) => res.status(404).json({ error:'Route not found' }));
app.listen(PORT,'0.0.0.0',() => console.log(`KARE ONE API running on ${PORT}`));
