const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on('error', (err) => console.error('PostgreSQL pool error', err));

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await query(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT','FACULTY','ADMIN')),
    register_number TEXT UNIQUE, employee_id TEXT UNIQUE, department TEXT,
    face_template JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, department TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), faculty_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id), class_name TEXT, latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL, allowed_radius_m INTEGER NOT NULL DEFAULT 50,
    qr_token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLOSED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id), register_number TEXT NOT NULL,
    face_verified BOOLEAN NOT NULL DEFAULT false, liveness_verified BOOLEAN NOT NULL DEFAULT false,
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, distance_meters DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'PRESENT' CHECK(status IN ('PRESENT','REJECTED')),
    rejection_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(session_id, student_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), action TEXT NOT NULL,
    details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

module.exports = { pool, query, transaction, ensureSchema };
