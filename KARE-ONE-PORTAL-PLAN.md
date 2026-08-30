# KARE ONE Portal Upgrade

## Next implementation phase

The existing SIS Smart Attendance repository is the deployment base. The unified KARE ONE portal will add three role-based experiences:

- Student: SIS dashboard, timetable, attendance history, QR scanner, face/liveness verification, GPS verification, distance-to-faculty validation.
- Faculty: timetable, start attendance, dynamic QR, configurable expiry/radius, live attendance, rejection reasons and reports.
- Admin: students, faculty, departments, subjects, timetable, attendance monitoring, audit logs and configuration.

## Attendance security

1. Faculty starts a short-lived attendance session.
2. Server creates a cryptographically random QR token and stores only its hash.
3. Student scans the QR while authenticated.
4. Server validates session, expiry and token.
5. Student face/liveness verification is required.
6. Student GPS is captured.
7. Server calculates Haversine distance from the faculty/session coordinates; client-provided distance is never trusted.
8. Server inserts attendance under a unique `(session_id, student_id)` constraint.
9. Duplicate submissions are rejected and security events are auditable.

## Deployment

`render.yaml` provisions the web application and PostgreSQL database. Production deployment must use HTTPS. The face service must be replaced with a production-grade face matching/liveness implementation before real biometric attendance is enabled.
