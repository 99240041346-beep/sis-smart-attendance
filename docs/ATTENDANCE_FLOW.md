# KARE ONE Attendance Flow

## Production-safe flow
1. Student signs in only after browser location permission is granted.
2. Faculty starts a live attendance session and shares the short-lived QR.
3. Student scans the live QR with the device camera.
4. Student location is captured with high accuracy.
5. The API calculates distance from the faculty session coordinates and rejects scans outside the configured radius.
6. The server rejects expired/invalid QR tokens, duplicate student attendance, and duplicate device use in a session.
7. A biometric provider may be connected for identity verification. The current development adapter must never be presented as a real biometric match.
8. Attendance is persisted in PostgreSQL with QR/GPS/device/audit metadata.

## Test account
- Register number: `99240041346`
- Password: `Harsha@2006`

The test account should be replaced before institutional production use.
