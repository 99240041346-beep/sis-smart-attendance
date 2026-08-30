"""Security helpers for KARE ONE attendance.

These functions are framework-independent so the Flask app and later API layer
can share the same validation logic.
"""
import hashlib
import math
import secrets


def new_qr_token() -> str:
    return secrets.token_urlsafe(32)


def hash_qr_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance between two WGS84 coordinates in metres."""
    radius = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def within_radius(student_lat, student_lon, faculty_lat, faculty_lon, radius_m) -> tuple[bool, float]:
    distance = haversine_distance_m(student_lat, student_lon, faculty_lat, faculty_lon)
    return distance <= radius_m, distance
