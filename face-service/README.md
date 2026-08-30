# KARE ONE Face Verification Service

This service is the security boundary for face enrollment, face matching, and liveness verification.

## Production requirements

- HTTPS only.
- Store face embeddings/templates encrypted and separately from ordinary profile data.
- Never store raw camera frames unless there is an explicit retention policy and lawful basis.
- Enrollment requires authenticated student/admin approval.
- Verification must return a signed/short-lived verification result; the browser must not be trusted to set `faceVerified=true`.
- Liveness should use a challenge-response or a vetted anti-spoofing model. Do not treat a simple face-detected result as liveness.

## API contract

`POST /enroll` — authenticated student enrollment; accepts a camera capture and returns an enrollment identifier.

`POST /verify` — accepts a live capture plus student/session context and returns `{ verified, livenessVerified, verificationId, expiresAt }`.

The KARE ONE attendance API should accept only a server-issued verification result and validate its signature/expiry before recording attendance.

## Development

The repository intentionally does not ship a fake face matcher or a fake liveness check. Plug in a vetted computer-vision/biometric provider or an approved on-premise model before enabling attendance acceptance.
