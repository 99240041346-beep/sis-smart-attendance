# Harsha SIS Smart Attendance Portal

## Run locally
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py

## Default administrator
Register Number: SISADMIN
Password: admin123

Set ADMIN_PASSWORD in Render for production.

## Render
Build: pip install -r requirements.txt
Start: gunicorn app:app

Environment variables:
SECRET_KEY = generated/secure value
ADMIN_PASSWORD = your secure admin password
DATABASE_URL = Render PostgreSQL Internal Database URL

## Attendance security workflow
Faculty creates a five-minute QR/token session with faculty GPS.
Student submits the token, browser GPS, and face-verification completion.
The server calculates Haversine distance and rejects attendance beyond 50 meters.
The face component is intentionally a development scaffold; connect a real consent-based biometric service before production use.
