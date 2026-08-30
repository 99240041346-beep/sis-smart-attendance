# KARE SIS / KARE ONE Master UI Build Specification

## Purpose
Recreate the supplied KARE SIS student portal as the visual and interaction baseline, then apply the same information architecture and visual language to Faculty and Admin. Extend it with KARE ONE attendance, examination, profile, permission, finance and analytics features.

## Visual system
- Dark charcoal left navigation with compact typography.
- Institutional blue top/header bars and cyan section headers.
- White/light-gray page background.
- Dense Bootstrap-style tables with borders, pagination, search and compact controls.
- Small form controls, dropdowns, checkboxes, status indicators and action buttons.
- Profile/avatar area in the header with Profile and Log Out actions.
- Avoid SaaS-style cards, gradients, oversized typography and decorative redesigns.
- Preserve desktop-first SIS density while remaining responsive.

## Student information architecture
Dashboard; Exam Papers; Revaluation; Semester (Attendance Details, Mark Details, Registration); Hall Ticket; Course Registration; PhD Course Registration; Course Withdrawal; Arrear Registration; Backlog Registration; Grade; Seating & Time Table; Industrial Training/TPO; Online Courses; One Credit; Online/Intern/IT Courses; Non-CGPA; Fees; Course Feedback; Circulars; Koha Automation; Hostel Booking; Transport Booking; Change Password; Academic Calendar; Permission/Leave; Secure Attendance.

## Student page behavior
Every menu item must resolve to a real route and API-backed page. Tables must support loading, empty, error and populated states. Forms require validation and server authorization. Actions must give success/error feedback and update persisted data.

## Student data modules
- Profile: identity, academic details, contact details and official profile photo.
- Attendance: subject, conducted, attended, leave categories, percentage, target percentage and classes required to recover.
- Marks/Grade: internal/external components, grade, grade point, credits, SGPA/CGPA and semester history.
- Registration: available courses, selected courses, add/drop/withdraw workflow.
- Examination: published schedules, room, seat and official profile photo on printable/downloadable hall ticket.
- Fees: fee heads, billed, paid, balance, payment state and receipts. Never claim payment success without a configured gateway.
- Non-CGPA/CPG: activity records, credits, status and supporting evidence.
- Feedback/Circulars/Calendar: real records with appropriate read/submit actions.
- Permission/Leave: application, supporting document, status, faculty/admin approval and audit trail.

## Faculty portal
Use the same header/sidebar/section/table language. Modules: Dashboard; Profile; My Subjects; My Classes; Students; Attendance Details; Start Attendance; Live Attendance; QR Session; Attendance Reports; Marks; Grade; Timetable; Permission Requests; Reports.

Faculty attendance flow: choose class/subject -> capture faculty location -> configure radius and expiry -> create session -> display rotating/live QR -> monitor attendance in real time -> close session. Faculty can approve/reject permission requests and record remarks.

## Admin portal
Use the same SIS visual language. Modules: Dashboard; Students; Faculty; Departments/Programs; Subjects; Classes; Semester; Attendance Monitor; Permission Management; Examinations; Exam Schedules; Rooms; Seat Allocation; Hall Ticket Publishing; Fees/Payments; CPG/Non-CGPA; Marks/Results; Circulars; Reports; System Settings.

## KARE ONE secure attendance
QR scan -> authenticated student -> QR/session validation -> face verification -> liveness -> browser GPS -> server-side distance/radius check -> session expiry/time check -> duplicate check -> atomic PostgreSQL transaction -> Present/Rejected. No client-side success flag is trusted.

## Profile/photo identity
Student uploads official photo using multipart upload to configurable object storage. Store metadata/URL, not binary image data in the core relational record. The same official photo is used by profile, hall ticket and face-enrollment workflow. Faculty profiles follow the same model.

## Examination workflow
Admin creates examination -> academic year/semester/name/dates -> add subject schedules -> date/time -> room -> seat allocation -> publish -> student sees published hall ticket -> generate printable/downloadable PDF containing official profile photo and exam details.

## Permission workflow
Student -> Apply Permission/Leave -> Pending -> Faculty review -> Approved/Rejected -> Admin review when configured -> student status notification -> academic/attendance record updated where policy permits. Students cannot self-approve.

## Attendance analytics
Show live subject percentage and a deterministic recovery calculation: if target is T%, attended A and conducted C, minimum future classes x satisfy (A+x)/(C+x) >= T. Also show risk/recovery status. Forecasts must be clearly labelled as calculations, not fabricated AI predictions.

## Button contract
Every visible button must: navigate to a real route, submit a real API operation, open a real modal/form, download a real generated artifact, or show an explicit configuration/permission error. No dead buttons and no fake success.

## External integrations
Payment and biometric/liveness providers remain configuration-driven. If credentials/provider are missing, show a clear not-configured state. Development test adapters must be clearly marked and never silently used as production verification.

## Acceptance test
Student login -> dashboard -> each Student menu -> profile/photo -> attendance -> secure attendance -> marks/grade -> registration -> exam/hall ticket -> timetable -> Non-CGPA/CPG -> fees -> results -> feedback/circulars/calendar -> permission. Then Faculty login and live attendance/approval. Then Admin login and complete exam/seat/publish/finance/management workflows. Finally run production build and Render health/API regression tests.