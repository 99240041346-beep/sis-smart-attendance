const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getPool } = require('./db');

async function main() {
  const pool = getPool();
  const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
  await pool.query(schema);

  const users = [
    { role: 'admin', fullName: 'KARE ONE Administrator', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    { role: 'faculty', fullName: 'Demo Faculty', employeeId: process.env.FACULTY_ID, password: process.env.FACULTY_PASSWORD },
    { role: 'student', fullName: 'Demo Student', registerNo: process.env.STUDENT_REGISTER, password: process.env.STUDENT_PASSWORD }
  ].filter((u) => u.password && (u.email || u.employeeId || u.registerNo));

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 12);
    await pool.query(
      `INSERT INTO users (register_no, employee_id, full_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [user.registerNo || null, user.employeeId || null, user.fullName, user.email || null, hash, user.role]
    );
  }

  console.log('KARE ONE database initialized');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
