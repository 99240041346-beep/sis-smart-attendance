const express = require('express');
const router = express.Router();
const { query } = require('./db');

const auth = require('./middleware/auth');
const requireRole = require('./middleware/role');

router.use(auth, requireRole('ADMIN'));
router.get('/stats', async (_req,res,next)=>{try{const [s,f,a,c]=await Promise.all([query("SELECT count(*)::int AS count FROM users WHERE role='STUDENT'"),query("SELECT count(*)::int AS count FROM users WHERE role='FACULTY'"),query("SELECT count(*)::int AS count FROM attendance WHERE status='PRESENT' AND created_at::date=CURRENT_DATE"),query("SELECT count(*)::int AS count FROM attendance_sessions WHERE status='ACTIVE' AND expires_at>now()")]);res.json({students:s.rows[0].count,faculty:f.rows[0].count,attendanceToday:a.rows[0].count,activeSessions:c.rows[0].count})}catch(e){next(e)}});
router.get('/users', async (_req,res,next)=>{try{const r=await query("SELECT id,full_name,email,role,register_number,employee_id,department,created_at FROM users ORDER BY created_at DESC");res.json(r.rows)}catch(e){next(e)}});
router.get('/subjects', async (_req,res,next)=>{try{const r=await query('SELECT * FROM subjects ORDER BY code');res.json(r.rows)}catch(e){next(e)}});
router.get('/attendance', async (_req,res,next)=>{try{const r=await query(`SELECT a.id,a.register_number,a.status,a.distance_meters,a.face_verified,a.liveness_verified,a.rejection_reason,a.created_at,s.class_name,sub.code subject_code,sub.name subject_name FROM attendance a JOIN attendance_sessions s ON s.id=a.session_id LEFT JOIN subjects sub ON sub.id=s.subject_id ORDER BY a.created_at DESC LIMIT 500`);res.json(r.rows)}catch(e){next(e)}});
module.exports=router;
