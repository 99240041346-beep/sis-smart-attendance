const express = require('express');
const { query, transaction } = require('./db');

/**
 * Permission/leave workflow for the SIS portal.
 * Mount with: app.use('/api/permissions', auth, permissionRoutes)
 * The module deliberately does not trust a client supplied status.
 */
const router = express.Router();

async function ensurePermissionSchema() {
  await query(`CREATE TABLE IF NOT EXISTS permission_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL DEFAULT 'Class Permission',
    permission_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    subject_id UUID REFERENCES subjects(id),
    reason TEXT NOT NULL,
    document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
    faculty_id UUID REFERENCES app_users(id),
    faculty_remarks TEXT,
    admin_id UUID REFERENCES app_users(id),
    admin_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_permission_student ON permission_requests(student_id, created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_permission_status ON permission_requests(status, permission_date)');
}

// Student: submit a new request.
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student role required' });
    const { permissionType, permissionDate, startTime, endTime, subjectId, reason, documentUrl } = req.body || {};
    if (!permissionDate || !reason?.trim()) return res.status(400).json({ error: 'Permission date and reason are required' });
    const q = await query(`INSERT INTO permission_requests
      (student_id, permission_type, permission_date, start_time, end_time, subject_id, reason, document_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`, [req.user.id, permissionType || 'Class Permission', permissionDate, startTime || null, endTime || null, subjectId || null, reason.trim(), documentUrl || null]);
    res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not submit permission request' });
  }
});

// Student: see own requests.
router.get('/mine', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student role required' });
    const q = await query(`SELECT p.*, s.code AS subject_code, s.name AS subject_name
      FROM permission_requests p LEFT JOIN subjects s ON s.id=p.subject_id
      WHERE p.student_id=$1 ORDER BY p.created_at DESC`, [req.user.id]);
    res.json(q.rows);
  } catch (e) { res.status(500).json({ error: 'Could not load permission requests' }); }
});

// Student: cancel only their own pending request.
router.patch('/:id/cancel', async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student role required' });
  const q = await query(`UPDATE permission_requests SET status='Cancelled', updated_at=now()
    WHERE id=$1 AND student_id=$2 AND status='Pending' RETURNING *`, [req.params.id, req.user.id]);
  if (!q.rowCount) return res.status(409).json({ error: 'Request is not pending or does not belong to this student' });
  res.json(q.rows[0]);
});

// Faculty: pending queue. Optional subject/class filters can be added later.
router.get('/faculty/pending', async (req, res) => {
  if (!['faculty','admin'].includes(req.user.role)) return res.status(403).json({ error: 'Faculty role required' });
  const q = await query(`SELECT p.*, u.name AS student_name, u.register_number, s.code AS subject_code, s.name AS subject_name
    FROM permission_requests p JOIN app_users u ON u.id=p.student_id
    LEFT JOIN subjects s ON s.id=p.subject_id
    WHERE p.status='Pending' ORDER BY p.permission_date, p.start_time NULLS FIRST, p.created_at`);
  res.json(q.rows);
});

// Faculty: approve/reject. A faculty member can only transition Pending requests.
router.patch('/:id/review', async (req, res) => {
  if (!['faculty','admin'].includes(req.user.role)) return res.status(403).json({ error: 'Faculty/admin role required' });
  const { decision, remarks } = req.body || {};
  if (!['Approved','Rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be Approved or Rejected' });
  try {
    const q = await query(`UPDATE permission_requests SET status=$1, faculty_id=$2, faculty_remarks=$3, updated_at=now()
      WHERE id=$4 AND status='Pending' RETURNING *`, [decision, req.user.id, remarks || null, req.params.id]);
    if (!q.rowCount) return res.status(409).json({ error: 'Request is no longer pending' });
    await query('INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)', [req.user.id, `PERMISSION_${decision.toUpperCase()}`, JSON.stringify({ requestId: req.params.id })]);
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Permission review failed' }); }
});

// Admin: full queue and final administrative review.
router.get('/admin/all', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  const q = await query(`SELECT p.*, u.name AS student_name, u.register_number, u.department,
      s.code AS subject_code, s.name AS subject_name
    FROM permission_requests p JOIN app_users u ON u.id=p.student_id
    LEFT JOIN subjects s ON s.id=p.subject_id ORDER BY p.created_at DESC`);
  res.json(q.rows);
});

router.patch('/:id/admin-review', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  const { decision, remarks } = req.body || {};
  if (!['Approved','Rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be Approved or Rejected' });
  const q = await query(`UPDATE permission_requests SET status=$1, admin_id=$2, admin_remarks=$3, updated_at=now()
    WHERE id=$4 AND status IN ('Pending','Approved') RETURNING *`, [decision, req.user.id, remarks || null, req.params.id]);
  if (!q.rowCount) return res.status(409).json({ error: 'Request cannot be changed from its current state' });
  res.json(q.rows[0]);
});

module.exports = { router, ensurePermissionSchema };
