# KARE ONE SIS — Module Blueprint

This is the target unified portal scope. Modules are role-gated and backed by PostgreSQL.

## Student
- Dashboard: attendance percentage, AI attendance forecast, classes needed/can-miss, alerts
- Profile: official photo, personal/academic details, face enrollment status
- Hall Ticket: generated from current profile photo and examination data
- Attendance: history, subject-wise percentage, QR attendance
- Secure Attendance: QR + GPS + server-side distance + face/liveness + duplicate protection
- Timetable and calendar
- Internal marks / results
- Examination schedule and hall ticket
- Fees: total fee, paid, due, receipts, transaction history, payment status
- Scholarships / concessions (if applicable)
- CPG: academic/progression records as configured by institution
- Non-CGP: co-curricular/extracurricular records as configured by institution
- Leave / attendance requests
- Notices, announcements and notifications
- Documents / certificates
- Transport / hostel / library modules where institutional data is available

## Faculty
- Faculty profile + official photo + face enrollment
- Dashboard
- Timetable / assigned subjects
- Start attendance and live QR
- Live attendance list with Present/Rejected reason and distance
- Attendance correction workflow with audit trail
- Student roster
- Internal marks / academic records
- Leave/requests and announcements
- Reports

## Admin
- Dashboard and KPIs
- Student/faculty management
- Subjects, sections, timetable and academic configuration
- Attendance sessions and audit logs
- Fee structures, invoices, payments, refunds/status reconciliation
- CPG / Non-CGP configuration and records
- Examination and hall-ticket management
- Notices and notifications
- Reports/export
- Role/permission management

## Payments and fees
Use a payment gateway only after merchant credentials and institutional approval are supplied. Store gateway transaction/reference IDs and status; do not store card numbers, CVV, UPI PINs, or other payment secrets. Fee records should support invoice amount, concessions, amount paid, balance, due date, payment status, receipt number, gateway reference and timestamps.

## CPG / Non-CGP
The labels are kept configurable because institutions can define these records differently. Do not hard-code a grading/credit policy until the institution supplies its official rules. Support categories, activities, credits/points, evidence documents, verification status, academic year/semester and audit history.

## Security
- Role-based authorization on every API
- Server-side attendance validation
- Short-lived QR tokens
- One attendance record per student/session
- GPS distance calculated server-side
- Face/liveness result issued by trusted verification service
- Audit trail for administrative changes
- Least-privilege database access
