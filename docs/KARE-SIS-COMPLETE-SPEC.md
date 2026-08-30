# KARE ONE — KARE SIS Complete Feature Specification

KARE ONE is a reconstruction/update of the KARE SIS-style portal, preserving the institutional information architecture and adding secure smart attendance.

## Student portal
- SIS-style login: register number or email + password
- Dashboard / profile popup / official profile photo
- Personal, academic and contact details
- Semester selector
- Attendance Details with conducted, attended, leave and percentage
- Smart attendance: Scan QR → face/liveness → GPS → distance → server validation
- Duplicate attendance prevention per session/register number
- Mark Details
- Grade / SGPA / CGPA / result history
- Registration / Course Registration / withdrawal / arrear / backlog
- Hall Ticket with published exam schedules, room, seat and official profile photo
- Printable/downloadable Hall Ticket PDF
- Seating & Time Table
- Non-CGPA activities
- CPG / fee categories
- Fees and payment status
- Results
- Online Courses / One Credit / Intern / IT Courses
- Course Feedback
- Circulars
- Hostel Booking
- Transport Booking
- Academic Calendar
- Change Password / Logout
- Live attendance prediction: current percentage, target percentage, projected percentage and classes required to recover

## Faculty portal
- SIS-style faculty profile
- Assigned subjects/classes
- Timetable
- Start attendance session
- Faculty GPS capture
- Configurable attendance radius
- Configurable QR expiry
- Cryptographically random live QR
- Live attendance monitor
- Student list
- Attendance history and reports
- Face/liveness verification status
- Subject-wise analytics

## Admin portal
- SIS-style administration shell
- Student management
- Faculty management
- Departments/programmes/classes
- Subjects and faculty assignment
- Academic year / semester management
- Examination creation
- Exam subjects, dates and times
- Room and seat assignment
- Publish/unpublish schedules
- Hall-ticket generation control
- Attendance monitoring and audit logs
- Fees/payment records
- Results/grade management
- Reports
- System settings

## Security attendance transaction
1. Student authenticates.
2. Faculty starts a live session.
3. Server creates a random QR token and stores only its hash.
4. Student scans the live QR.
5. Server validates session and expiry.
6. Camera/liveness provider returns a verified result.
7. Browser requests high-accuracy GPS.
8. Server calculates Haversine distance from faculty coordinates.
9. Server rejects students outside the configured radius.
10. Server checks student identity and register number.
11. Database transaction enforces one attendance per student/session.
12. Audit log records accepted/rejected result.

No production attendance success is allowed from a fake face/liveness flag. A real provider must be configured before production biometric acceptance.

## Production dependencies requiring institution configuration
- Real face/liveness provider credentials and endpoint
- Object storage credentials for durable profile photos on Render
- Payment gateway credentials/merchant configuration
- Institutional student/faculty/subject/fee/result data import

## UI direction
The interface intentionally follows the provided KARE SIS reference screenshots: dark left navigation, compact institutional tables, blue/cyan section headers, profile area, semester menus and dense academic information pages. KARE ONE security/administration features are integrated into that shell instead of replacing it with a generic dashboard.
