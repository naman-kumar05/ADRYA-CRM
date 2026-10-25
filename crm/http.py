import re
from decimal import Decimal, InvalidOperation

from django.contrib.auth.views import redirect_to_login
from django.core.cache import cache
from django.shortcuts import render

from .access import can

MOBILE = re.compile(r"^[6-9]\d{9}$")


def rate_limit(bucket, limit, seconds):
    key = f"rl:{bucket}"
    if cache.add(key, 1, seconds):
        return True
    try:
        hits = cache.incr(key)
    except ValueError:
        cache.set(key, 1, seconds)
        return True
    return hits <= limit


def require(request, action=None):
    if not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path())
    if action and not can(request.user.role, action):
        return render(request, "forbidden.html", status=403)
    return None


def client_ip(request):
    return (request.META.get("REMOTE_ADDR") or "")[:64]


def safe_next(value, fallback):
    if value and value.startswith("/") and not value.startswith("//"):
        return value
    return fallback


def clean_mobile(raw):
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if not MOBILE.match(digits):
        raise ValueError("Enter a 10-digit mobile starting with 6, 7, 8, or 9.")
    return digits


def money(raw):
    text = (raw or "").strip().replace(",", "")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("Enter a valid amount.") from exc


def checked(post, name):
    return post.get(name) in {"on", "true", "True", "1", "yes"}


def split_list(raw):
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def aware(raw):
    from datetime import datetime

    from django.utils import timezone

    text = (raw or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("Enter a valid date.") from exc
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed
