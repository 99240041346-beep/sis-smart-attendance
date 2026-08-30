const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
});
pool.on('error', err => console.error('PostgreSQL pool error', err));
const query = (text, params) => pool.query(text, params);
async function transaction(work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
async function ensureSchema(){
 await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
 await query(`CREATE TABLE IF NOT EXISTS app_users(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','faculty','admin')),
  register_number TEXT UNIQUE, employee_id TEXT UNIQUE, department TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, face_template JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await query(`CREATE TABLE IF NOT EXISTS subjects(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  department TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await query(`CREATE TABLE IF NOT EXISTS timetable(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id UUID REFERENCES subjects(id),
  faculty_id UUID REFERENCES app_users(id), class_name TEXT NOT NULL, day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL, end_time TIME NOT NULL, room TEXT)`);
 await query(`CREATE TABLE IF NOT EXISTS attendance_sessions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id UUID REFERENCES subjects(id), faculty_id UUID NOT NULL REFERENCES app_users(id),
  class_name TEXT, qr_token_hash TEXT NOT NULL, faculty_latitude DOUBLE PRECISION NOT NULL, faculty_longitude DOUBLE PRECISION NOT NULL,
  allowed_radius_m INTEGER NOT NULL DEFAULT 50 CHECK(allowed_radius_m BETWEEN 5 AND 1000),
  expires_at TIMESTAMPTZ NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await query(`CREATE TABLE IF NOT EXISTS attendance_records(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES app_users(id), register_number TEXT NOT NULL, qr_verified BOOLEAN NOT NULL DEFAULT false,
  face_verified BOOLEAN NOT NULL DEFAULT false, liveness_verified BOOLEAN NOT NULL DEFAULT false,
  student_latitude DOUBLE PRECISION, student_longitude DOUBLE PRECISION, distance_m DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'Present' CHECK(status IN ('Present','Rejected')), rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(session_id,student_id))`);
 await query(`CREATE TABLE IF NOT EXISTS audit_logs(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES app_users(id), action TEXT NOT NULL,
  details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await query('CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id)');
 await query('CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id)');
 await query('CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON attendance_sessions(expires_at)');
}
module.exports={pool,query,transaction,ensureSchema};
