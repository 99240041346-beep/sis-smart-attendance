import os
import math
import secrets
from datetime import datetime, date, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, session, jsonify
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-change-me")
database_url = os.environ.get("DATABASE_URL", "sqlite:///attendance.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    register_number = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, value):
        self.password_hash = generate_password_hash(value)

    def check_password(self, value):
        return check_password_hash(self.password_hash, value)


class StudentProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    programme = db.Column(db.String(180), default="B.Tech. / Computer Science and Engineering")
    batch = db.Column(db.String(30), default="2024")
    section = db.Column(db.String(30), default="24S19")
    faculty_advisor = db.Column(db.String(180), default="Not assigned")
    face_reference = db.Column(db.String(255))
    user = db.relationship("User", backref=db.backref("student_profile", uselist=False))


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(180), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    classes_conducted = db.Column(db.Integer, default=0)
    faculty = db.relationship("User", foreign_keys=[faculty_id])


class AttendanceSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    token = db.Column(db.String(120), unique=True, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    radius_m = db.Column(db.Float, default=50.0)
    expires_at = db.Column(db.DateTime, nullable=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    course = db.relationship("Course")
    faculty = db.relationship("User")


class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("attendance_session.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Present")
    distance_m = db.Column(db.Float)
    qr_verified = db.Column(db.Boolean, default=False)
    face_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    session_ref = db.relationship("AttendanceSession", backref="attendance_records")
    student = db.relationship("User")


class Notice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    audience = db.Column(db.String(20), default="all")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            flash("Please sign in first.", "warning")
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get("user_id"):
                return redirect(url_for("login"))
            user = db.session.get(User, session["user_id"])
            if not user or user.role not in roles:
                flash("You do not have permission to access that page.", "danger")
                return redirect(url_for("dashboard"))
            return fn(*args, **kwargs)
        return wrapper
    return deco


def current_user():
    uid = session.get("user_id")
    return db.session.get(User, uid) if uid else None


def distance_m(lat1, lon1, lat2, lon2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * r * math.asin(math.sqrt(a))


@app.context_processor
def globals():
    return {"current_user": current_user(), "year": datetime.now().year}


with app.app_context():
    db.create_all()

    admin = User.query.filter_by(register_number="SISADMIN").first()
    if not admin:
        admin = User(
            register_number="SISADMIN",
            name="SIS Main Administrator",
            email="admin@sis.edu"
        )
        admin.role = "admin"
        admin.set_password(os.environ.get("ADMIN_PASSWORD", "admin123"))
        db.session.add(admin)
        db.session.commit()

    if Notice.query.count() == 0:
        db.session.add(Notice(
            title="Welcome to SIS Smart Attendance",
            body="Use QR + location + face verification during the active attendance window.",
            audience="all"
        ))
        db.session.commit()


@app.route("/")
def index():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        reg = request.form.get("register_number", "").strip()
        password = request.form.get("password", "")
        remember = bool(request.form.get("remember"))
        user = User.query.filter_by(register_number=reg).first()
        if user and user.check_password(password):
            session.clear()
            session["user_id"] = user.id
            session.permanent = remember
            flash(f"Welcome, {user.name}.", "success")
            return redirect(url_for("dashboard"))
        flash("Invalid register number or password.", "danger")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        user = User.query.filter_by(email=email).first()
        if user:
            session["reset_user_id"] = user.id
            flash("Account verified for demo reset. Set a new password.", "success")
            return redirect(url_for("reset_password"))
        flash("No account found for that email.", "danger")
    return render_template("forgot_password.html")


@app.route("/reset-password", methods=["GET", "POST"])
def reset_password():
    uid = session.get("reset_user_id")
    user = db.session.get(User, uid) if uid else None
    if not user:
        return redirect(url_for("forgot_password"))
    if request.method == "POST":
        p = request.form.get("password", "")
        c = request.form.get("confirm_password", "")
        if len(p) < 6 or p != c:
            flash("Use at least 6 characters and make both passwords match.", "danger")
        else:
            user.set_password(p)
            db.session.commit()
            session.pop("reset_user_id", None)
            flash("Password changed. Please sign in.", "success")
            return redirect(url_for("login"))
    return render_template("reset_password.html")


@app.route("/dashboard")
@login_required
def dashboard():
    u = current_user()
    if u.role == "student":
        return redirect(url_for("student_dashboard"))
    if u.role == "faculty":
        return redirect(url_for("faculty_dashboard"))
    return redirect(url_for("admin_dashboard"))


@app.route("/student")
@role_required("student")
def student_dashboard():
    u = current_user()
    records = Attendance.query.filter_by(student_id=u.id).order_by(Attendance.created_at.desc()).limit(10).all()
    total = Attendance.query.filter_by(student_id=u.id).count()
    present = Attendance.query.filter_by(student_id=u.id, status="Present").count()
    pct = round((present / total) * 100, 1) if total else 0
    notices = Notice.query.filter(Notice.audience.in_(["all", "student"])).order_by(Notice.created_at.desc()).limit(6).all()
    return render_template("student_dashboard.html", user=u, records=records, percentage=pct, notices=notices)


@app.route("/faculty")
@role_required("faculty")
def faculty_dashboard():
    u = current_user()
    courses = Course.query.filter_by(faculty_id=u.id).all()
    sessions = AttendanceSession.query.filter_by(faculty_id=u.id).order_by(AttendanceSession.created_at.desc()).limit(10).all()
    return render_template("faculty_dashboard.html", user=u, courses=courses, sessions=sessions)


@app.route("/admin")
@role_required("admin")
def admin_dashboard():
    return render_template(
        "admin_dashboard.html",
        students=User.query.filter_by(role="student").count(),
        faculty=User.query.filter_by(role="faculty").count(),
        courses=Course.query.count(),
        sessions=AttendanceSession.query.count()
    )


@app.route("/admin/create-user", methods=["POST"])
@role_required("admin")
def create_user():
    role = request.form.get("role", "student")
    if role not in ("student", "faculty"):
        flash("Invalid role.", "danger")
        return redirect(url_for("admin_dashboard"))
    reg = request.form.get("register_number", "").strip()
    email = request.form.get("email", "").strip().lower()
    name = request.form.get("name", "").strip()
    password = request.form.get("password", "welcome123")
    if not reg or not email or not name:
        flash("Name, register number and email are required.", "danger")
        return redirect(url_for("admin_dashboard"))
    if User.query.filter((User.register_number == reg) | (User.email == email)).first():
        flash("Register number or email already exists.", "warning")
        return redirect(url_for("admin_dashboard"))
    u = User(register_number=reg, name=name, email=email, role=role)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    if role == "student":
        db.session.add(StudentProfile(user_id=u.id))
        db.session.commit()
    flash(f"{role.title()} account created.", "success")
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/create-course", methods=["POST"])
@role_required("admin")
def create_course():
    code = request.form.get("code", "").strip()
    name = request.form.get("name", "").strip()
    faculty_id = request.form.get("faculty_id", type=int)
    if not code or not name:
        flash("Course code and name are required.", "danger")
        return redirect(url_for("admin_dashboard"))
    if Course.query.filter_by(code=code).first():
        flash("Course code already exists.", "warning")
        return redirect(url_for("admin_dashboard"))
    db.session.add(Course(code=code, name=name, faculty_id=faculty_id))
    db.session.commit()
    flash("Course created.", "success")
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/notices", methods=["POST"])
@role_required("admin")
def create_notice():
    title = request.form.get("title", "").strip()
    body = request.form.get("body", "").strip()
    if title and body:
        db.session.add(Notice(title=title, body=body, audience="all"))
        db.session.commit()
        flash("Notice published.", "success")
    return redirect(url_for("admin_dashboard"))


@app.route("/faculty/session", methods=["POST"])
@role_required("faculty")
def create_session():
    course_id = request.form.get("course_id", type=int)
    lat = request.form.get("latitude", type=float)
    lon = request.form.get("longitude", type=float)
    if course_id is None or lat is None or lon is None:
        flash("Course and faculty location are required.", "danger")
        return redirect(url_for("faculty_dashboard"))
    course = db.session.get(Course, course_id)
    if not course or course.faculty_id != current_user().id:
        flash("Invalid course.", "danger")
        return redirect(url_for("faculty_dashboard"))
    token = secrets.token_urlsafe(24)
    s = AttendanceSession(
        course_id=course.id, faculty_id=current_user().id,
        token=token, latitude=lat, longitude=lon,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        radius_m=50
    )
    course.classes_conducted += 1
    db.session.add(s)
    db.session.commit()
    flash("Attendance QR session created. Share the token/QR with students.", "success")
    return redirect(url_for("faculty_dashboard"))


@app.route("/attendance/<token>", methods=["GET", "POST"])
@role_required("student")
def mark_attendance(token):
    s = AttendanceSession.query.filter_by(token=token, active=True).first()
    if not s:
        return render_template("attendance_result.html", ok=False, message="Attendance session not found.")
    if datetime.utcnow() > s.expires_at:
        s.active = False
        db.session.commit()
        return render_template("attendance_result.html", ok=False, message="QR attendance session has expired.")
    if Attendance.query.filter_by(session_id=s.id, student_id=current_user().id).first():
        return render_template("attendance_result.html", ok=False, message="Attendance already recorded.")

    lat = request.form.get("latitude", type=float)
    lon = request.form.get("longitude", type=float)
    face = request.form.get("face_verified") == "1"
    if lat is None or lon is None:
        return render_template("attendance_result.html", ok=False, message="Location permission is required.")
    dist = distance_m(lat, lon, s.latitude, s.longitude)
    if dist > s.radius_m:
        return render_template("attendance_result.html", ok=False, message=f"Outside 50 m range ({dist:.1f} m).")
    if not face:
        return render_template("attendance_result.html", ok=False, message="Face verification is required.")

    db.session.add(Attendance(
        session_id=s.id, student_id=current_user().id, distance_m=dist,
        qr_verified=True, face_verified=True, status="Present"
    ))
    db.session.commit()
    return render_template("attendance_result.html", ok=True, message=f"Attendance marked successfully. Distance: {dist:.1f} m.")


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    u = current_user()
    if request.method == "POST":
        u.name = request.form.get("name", u.name).strip()
        u.email = request.form.get("email", u.email).strip().lower()
        db.session.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("profile"))
    return render_template("profile.html", user=u)


@app.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    u = current_user()
    if request.method == "POST":
        if not u.check_password(request.form.get("current_password", "")):
            flash("Current password is incorrect.", "danger")
        elif request.form.get("new_password", "") != request.form.get("confirm_password", ""):
            flash("Passwords do not match.", "danger")
        else:
            u.set_password(request.form.get("new_password", ""))
            db.session.commit()
            flash("Password changed.", "success")
            return redirect(url_for("profile"))
    return render_template("change_password.html")


@app.route("/api/location", methods=["POST"])
@login_required
def save_location():
    data = request.get_json(silent=True) or {}
    try:
        u = current_user()
        u.latitude = float(data["latitude"])
        u.longitude = float(data["longitude"])
        db.session.commit()
        return jsonify(ok=True)
    except (KeyError, ValueError, TypeError):
        return jsonify(ok=False, error="Invalid coordinates"), 400


@app.route("/api/attendance-prediction")
@role_required("student")
def prediction():
    u = current_user()
    total = Attendance.query.filter_by(student_id=u.id).count()
    present = Attendance.query.filter_by(student_id=u.id, status="Present").count()
    current = (present / total * 100) if total else 0
    return jsonify({
        "formula": "100 / classes_conducted × classes_attended",
        "classes_conducted": total,
        "classes_attended": present,
        "attendance_percentage": round(current, 2),
        "note": "Projection uses recorded attendance; future prediction requires scheduled class data."
    })


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
