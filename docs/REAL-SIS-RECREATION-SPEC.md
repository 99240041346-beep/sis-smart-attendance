# KARE SIS Recreation — Real Portal Analysis

## Source of truth

This specification is based on the student SIS screen recording supplied for the project, together with the existing KARE ONE implementation. The goal is to recreate the **information architecture, density, navigation, tables, forms, actions and workflow style** of the existing SIS and then add KARE ONE features inside that model.

Do not redesign the product as a generic modern dashboard.

## Visual language to preserve

- Dark charcoal/blue left sidebar with compact menu rows.
- Thin blue/cyan top/header bars.
- White content panels with blue section headers.
- Dense, spreadsheet-like DataTables.
- Small typography and compact spacing.
- Search, Show N entries, Copy, CSV, Print and column-visibility controls where appropriate.
- Bootstrap/DataTables-style pagination.
- Modal dialogs for actions such as revaluation and feedback.
- Footer with KARE/software-team/version information.
- Profile avatar/dropdown in the top-right.
- Semester/module navigation stays visible while content changes.

## Student structure observed in the recording

### Dashboard / profile
- SIS header and profile identity.
- Student register number in the header/profile menu.
- Profile action and logout.
- Personal information areas.
- Student navigation remains persistent.

### Examination / academic modules
- Exam Papers.
- Revaluation.
- Semester.
  - Attendance Details.
  - Mark Details.
  - Registration.
- Hall Ticket.
- Course Registration.
- PhD Course Registration.
- Course Withdrawal.
- Arrear Registration.
- Backlog Registration.
- Grade.
- Seating & Time Table.
- Industrial Training / TPO.
- Online Courses.
- One Credit.
- Online / Intern / IT Courses.
- NonCGPA.
- Fees.
- Course Feedback.
- Circulars.
- Koha Automation.
- Hostel Booking.
- Transport Booking.
- Change Password.
- Academic Calendar.
- Logout.

## Important page behavior captured

### Revaluation
- Registered-course table.
- Course code and course name.
- Exam/session information.
- Registration state can be closed.
- Action area for applying revaluation.

### Attendance Details
Table columns observed include:
- Semester / ID.
- Course code.
- Course name.
- No. of periods / conducted.
- Attended.
- On-duty.
- Medical Leave.
- Restricted Holiday.
- Extra Hours.
- Attendance Percentage.

The page uses compact DataTables controls and pagination.

### Registration / timetable
The recording shows a weekly timetable matrix with:
- Days Monday–Friday.
- Period columns from approximately 07:00 AM through 06:50 PM.
- Course codes placed in timetable cells.
- A course-registration/detail table below containing academic semester, course code, course name, category, theory/practical, faculty, WhatsApp/course-plan information.

### Course Withdrawal
- Registered course list.
- Course code/name.
- Empty-state table when no withdrawal data exists.
- Registration state/action can be closed.

### Grade Details
The recording shows a dense semester history table with:
- Semester.
- Course code.
- Course name.
- Credits.
- Attainment code.
- Grade.
- Category code.
- Year of passing.

Below the course history are credit/category summaries, including studied/earned/to-be-earned values and category rows.

### NonCGPA
- Registered NonCGPA entries.
- Registration date.
- Course code/name.
- Final-year restriction text.
- Apply NonCGPA workflow.
- Course selection and file upload.

### Fees
- Transaction/bill table.
- Bill number.
- Transaction date.
- Historical payment rows.
- This should become real fee ledger data in KARE ONE.

### Course Feedback
- Course code.
- Course name.
- Faculty/staff name.
- "Put Feedback" action per course.
- Feedback action opens an input workflow rather than simply navigating to an empty page.

### Change Password
- Old password.
- New password.
- Confirm password.
- Validation and submit action.

### Circulars
- Large paginated notice table.
- Circular date.
- Circular title.
- Examples include semester/exam timetables and special examinations.

## KARE ONE additions inside the SIS model

The following features must be integrated into the existing SIS information architecture rather than presented as an unrelated application:

1. Secure QR attendance.
2. Faculty-generated live QR.
3. Camera QR scanner.
4. GPS permission and high-accuracy coordinates.
5. Server-side distance/radius validation.
6. Session and expiry validation.
7. Duplicate attendance protection.
8. Face enrollment.
9. Real face verification.
10. Real liveness verification.
11. Profile photo upload/storage.
12. Hall-ticket PDF using the official profile photo.
13. Attendance prediction: current percentage, target percentage, classes required, and recovery feasibility.
14. Permission/leave request and approval workflow.
15. Examination creation, schedules, rooms and seats.
16. Fees/CPG/Non-CGP and payment status.
17. Results and CGPA/SGPA.
18. Audit/security records.

## Unified Faculty portal — same SIS model

Faculty must use the same visual shell and dense table/form pattern as Student.

### Navigation
- Dashboard.
- My Courses.
- Semester.
  - Course/Teaching Details.
  - Attendance Details.
  - Mark Entry.
  - Registration/Student List.
- Start Attendance.
- Live Attendance.
- Permission Requests.
- Students.
- Attendance Reports.
- Timetable.
- Exam / Invigilation where enabled.
- Profile.
- Change Password.
- Logout.

### Faculty dashboard
Use compact SIS-style panels rather than large marketing cards:
- Today's timetable.
- Active attendance sessions.
- Courses handled.
- Pending permission requests.
- Attendance exceptions.

### Faculty attendance
Faculty selects:
- Academic semester.
- Course/subject.
- Class/section.
- Date/period.
- Attendance radius.
- QR expiry.

Then:
`Start Session -> Generate Live QR -> Live Student Table -> Close Session`.

Live table columns:
- Register number.
- Student name.
- Scan time.
- Face status.
- Liveness status.
- GPS status.
- Distance.
- Final status.
- Rejection reason.

## Unified Admin portal — same SIS model

Admin must use the same sidebar/header/table/modal language.

### Navigation
- Dashboard.
- Student Management.
- Faculty Management.
- Academic Year / Semester.
- Subjects & Classes.
- Examinations.
- Schedules & Seats.
- Attendance Monitor.
- Permission Management.
- Fees & Payments.
- Results / Grades.
- Circulars.
- Reports.
- System Settings.
- Audit Log.
- Logout.

### Admin dashboard
Dense SIS-style operational tables:
- Student count.
- Faculty count.
- Active sessions.
- Today's attendance.
- Pending permissions.
- Pending fee/payment records.
- Upcoming examinations.
- Unpublished schedules.

### Examination management
`Create Examination -> Add Subjects/Schedules -> Assign Rooms/Seats -> Publish -> Student Hall Ticket`.

Schedule fields:
- Academic year.
- Semester.
- Exam name.
- Subject/code.
- Exam date.
- Start/end time.
- Room.
- Seat range/allocation.
- Publication status.

## Permission / leave workflow

### Student
Add **Permission / Leave** to the SIS navigation.

Form:
- Permission type.
- Date.
- Start time.
- End time.
- Course/class.
- Reason.
- Supporting document.
- Submit.

Student table:
- Request ID.
- Date.
- Type.
- Course.
- Submitted date.
- Status.
- Faculty/Admin remarks.

### Faculty
Add **Permission Requests**.

Actions:
- View.
- Approve.
- Reject.
- Add remarks.

### Admin
Add **Permission Management** for institution-wide review and escalation.

Statuses are server-controlled:
`PENDING -> APPROVED` or `PENDING -> REJECTED`.

Students cannot approve their own requests.

## Security rules

- No fake face verification.
- No fake liveness success.
- No fake payment success.
- Browser cannot be the final authority for attendance.
- Attendance must be validated server-side.
- Duplicate `(session_id, student_id)` is rejected.
- Expired QR/session is rejected.
- GPS/radius failure is rejected.
- Missing real biometric provider must produce a clear `provider not configured` state.
- Payment provider not configured must produce a clear configuration state.

## Acceptance criteria

A module is considered complete only when:

1. Its SIS-style page exists.
2. Its sidebar/menu action navigates correctly.
3. Its API exists where data is required.
4. Its data is persisted in PostgreSQL where applicable.
5. Its buttons execute real operations.
6. Loading, empty and error states are implemented.
7. Role authorization is enforced server-side.
8. The Render production build succeeds.
9. The deployed page can be manually tested end-to-end.

## End-to-end target

`Real SIS-style Login -> Student/Faculty/Admin role -> real PostgreSQL data -> SIS page -> real action -> database update -> reflected result`.

KARE ONE security and automation are additions to this existing SIS model, not a replacement for it.
