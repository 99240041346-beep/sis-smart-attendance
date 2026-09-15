# KARE ONE — SIS Smart Attendance

A clean full-stack rebuild of the KARE ONE student information and smart attendance portal.

## Current architecture

- `frontend/` — React + Vite portal for Student, Faculty and Admin roles
- `backend/` — Express API with JWT authentication and PostgreSQL access
- `database/schema.sql` — relational schema for users, subjects, sessions, attendance and audit logs

## API

- `GET /api/health` — service and database health
- `POST /api/auth/login` — role-based login
- `GET /api/me` — current user
- `GET /api/dashboard` — role dashboard data
- `GET /api/subjects` — subjects
- `POST /api/subjects` — admin subject creation
- `POST /api/attendance/sessions` — faculty starts a dynamic QR session
- `GET /api/attendance/sessions/:id` — session status
- `POST /api/attendance/scan` — student scans QR and marks attendance
- `GET /api/attendance/sessions/:id/records` — live attendance records
- `POST /api/attendance/sessions/:id/close` — faculty closes session

## Database setup

The application expects a PostgreSQL `DATABASE_URL` environment variable. Initialize a new KARE ONE database with:

```bash
cd backend
npm install
npm run db:init
```

Optional seed variables are used by `db:init`: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FACULTY_ID`, `FACULTY_PASSWORD`, `STUDENT_REGISTER`, `STUDENT_PASSWORD`.

Never commit real passwords or production secrets to Git.

## Render

The existing Render services are configured for this repository:

- Frontend: `kare-one-portal` → `frontend/`
- Backend: `kare-one-api` → `backend/`

Backend production environment requires `JWT_SECRET` and `DATABASE_URL`.
Frontend uses `VITE_API_URL=https://kare-one-api.onrender.com/api`.

## Development order

1. Foundation + API health
2. Authentication + role routing
3. Portal structure
4. QR attendance
5. Face verification
6. Location + faculty/student distance verification
7. Anti-proxy and audit controls
8. Reporting and production hardening

The QR layer is the first real attendance test. Face/GPS/anti-proxy are deliberately not mixed into this phase.
