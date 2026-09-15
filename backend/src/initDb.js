const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not configured; skipping database initialization.');
    return false;
  }

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await query(schema);

    const seeds = [
      ['student', 'student', null, 'Demo Student', 'student@kare.edu', 'student', 'Demo Department', '1', 'A'],
      [null, null, 'faculty', 'Demo Faculty', 'faculty@kare.edu', 'faculty', 'Demo Department', null, null],
      [null, null, 'admin', 'Demo Administrator', 'admin@kare.edu', 'admin', null, null, null]
    ];

    for (const [registerNo, employeeId, identifier, fullName, email, role, department, semester, section] of seeds) {
      const passwordHash = await bcrypt.hash(identifier, 12);
      await query(
        `INSERT INTO users(register_no, employee_id, full_name, email, password_hash, role, department, semester, section)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [registerNo, employeeId, fullName, email, passwordHash, role, department, semester, section]
      );
    }

    console.log('KARE ONE database schema and development users are ready.');
    return true;
  } catch (error) {
    console.warn('Database initialization skipped:', error.code || error.message);
    return false;
  }
}

module.exports = { initDb };
