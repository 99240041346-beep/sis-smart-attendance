# KARE ONE Portal Upgrade

## SIS-style product direction

The portal is intentionally designed as a unified KARE SIS-style interface: dark left navigation, compact blue section headers, dense academic tables, role-based menus and a simple institutional login. The reference navigation covers the student-facing academic workflow including dashboard, exam papers, evaluation, semester/attendance, hall ticket, course registration, arrear/backlog registration, grades, seating/timetable, online courses, one-credit/online-intern/IT courses, Non-CGPA, fees, feedback, circulars, hostel, transport, password and academic calendar.

The official public SIS login uses Register No + Password. KARE's public institutional material also describes SIS/EDU-KARE functions around course registration, attendance, marks, fee payment, hostel and transport booking, grievances/feedback and related academic administration. These concepts are reflected in the KARE ONE information architecture without copying private student data.

## Unified role-based portal

- Student: SIS dashboard, profile/photo, timetable, attendance details, mark/grade details, CGPA/Non-CGPA, hall ticket, exam seating, fees/payments, results, course registration, online/one-credit/IT courses, feedback, circulars, hostel, transport and secure QR attendance.
- Faculty: profile, assigned courses/classes, start attendance, dynamic QR, configurable expiry/radius, live attendance, rejection reasons, attendance history and reports.
- Admin: students, faculty, departments, subjects/classes, examinations, schedules/seats, attendance monitoring, fees/payments, results, reports and system settings.

## Attendance security

1. Faculty starts a short-lived attendance session.
2. Server creates a cryptographically random QR token and stores only its hash.
3. Student scans the QR while authenticated.
4. Server validates session, expiry and token.
5. Student face/liveness verification is required; the application must never mark a student present merely because a UI flag is set.
6. Student GPS is captured.
7. Server calculates Haversine distance from faculty/session coordinates; client-provided distance is never trusted.
8. Attendance is inserted in a database transaction.
9. A duplicate `(session_id, student_id)` submission is rejected atomically, so the same register number cannot register twice for one session.
10. Security/audit events are retained for administrative review.

## Examination and identity

- Admin creates examination, academic year, semester, start/end dates, subjects, exam date/time, room and seat allocation, then publishes.
- Students see published schedules immediately in Hall Ticket.
- Hall Ticket PDF uses the student's official stored profile photo.
- Profile photo is uploaded as an image file rather than relying on an arbitrary external URL.

## AI attendance planning

The student dashboard includes a live attendance forecast. The production implementation should calculate the minimum future classes required to reach the configured eligibility target from persisted attendance records, rather than inventing a percentage. Forecast thresholds must be configurable by academic policy.

## Deployment

`render.yaml` provisions the web application and PostgreSQL database. Production deployment must use HTTPS, strong generated secrets and persistent object storage for production profile photos. The biometric component must be replaced/configured with a production-grade face matching and liveness implementation before real biometric attendance is enabled.
