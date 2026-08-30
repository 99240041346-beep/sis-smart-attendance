const express = require('express');
const router = express.Router();
const { query } = require('./db');
const auth = require('./middleware/auth');
const requireRole = require('./middleware/role');

router.use(auth, requireRole('STUDENT'));

// Deterministic attendance planning: uses scheduled/held class counts and the
// institution's target percentage. This is an estimate, not a claim of ML prediction.
router.get('/forecast', async (req, res, next) => {
  try {
    const target = Math.min(100, Math.max(50, Number(req.query.target || 75)));
    const r = await query(`
      SELECT COUNT(*) FILTER (WHERE status='PRESENT')::int AS present,
             COUNT(*)::int AS held
      FROM attendance_records
      WHERE student_id=$1`, [req.user.id]);
    const present = r.rows[0].present || 0;
    const held = r.rows[0].held || 0;
    const current = held ? (present / held) * 100 : 0;
    let classesToAttend = 0;
    if (held && current < target) {
      // Smallest x where (present+x)/(held+x) >= target/100.
      classesToAttend = Math.max(0, Math.ceil(((target / 100) * held - present) / (1 - target / 100)));
    }
    const classesCanMiss = held ? Math.max(0, Math.floor((present - (target / 100) * held) / (target / 100))) : 0;
    res.json({ present, held, percentage: Number(current.toFixed(2)), target, classesToAttend, classesCanMiss });
  } catch (e) { next(e); }
});

module.exports = router;
