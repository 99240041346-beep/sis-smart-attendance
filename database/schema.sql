-- KARE ONE unified SIS smart-attendance database
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  register_number VARCHAR(80) UNIQUE,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','admin')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  department VARCHAR(120),
  face_template JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  faculty_id BIGINT REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT REFERENCES subjects(id),
  faculty_id BIGINT REFERENCES app_users(id),
  class_name VARCHAR(100) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id BIGINT NOT NULL REFERENCES subjects(id),
  faculty_id BIGINT NOT NULL REFERENCES app_users(id),
  class_name VARCHAR(100),
  qr_token_hash VARCHAR(128) NOT NULL UNIQUE,
  faculty_latitude DOUBLE PRECISION NOT NULL,
  faculty_longitude DOUBLE PRECISION NOT NULL,
  allowed_radius_m DOUBLE PRECISION NOT NULL DEFAULT 50 CHECK (allowed_radius_m > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES app_users(id),
  register_number VARCHAR(80) NOT NULL,
  qr_verified BOOLEAN NOT NULL DEFAULT FALSE,
  face_verified BOOLEAN NOT NULL DEFAULT FALSE,
  liveness_verified BOOLEAN NOT NULL DEFAULT FALSE,
  student_latitude DOUBLE PRECISION,
  student_longitude DOUBLE PRECISION,
  distance_m DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'Present' CHECK (status IN ('Present','Rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_attendance_per_student_session UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id),
  action VARCHAR(120) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
