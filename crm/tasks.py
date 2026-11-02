"""Async tasks executed by the django-q2 worker process.

Start the worker with:  python manage.py qcluster
Schedule hourly tasks:  python manage.py qschedule  (or configure via django-q2 admin)
"""
import logging

logger = logging.getLogger(__name__)


def flag_stale_leads():
    """Create 48-hour stale-lead follow-up reminders for all eligible managers.

    Scheduled to run hourly via django-q2. Replaces the synchronous
    ensure_stale_reminders() call that previously ran on every dashboard load.
    """
    from .models import User
    from .services import ensure_stale_reminders

    actors = User.objects.filter(
        is_active=True,
        role__in=["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
    )
    total = sum(ensure_stale_reminders(actor) for actor in actors)
    logger.info("flag_stale_leads: created %d reminders", total)
    return total


def send_assignment_notification(user_id, title, body, href=""):
    """Create an in-app notification asynchronously so assignment never blocks a request."""
    from .models import Notification

    Notification.objects.create(user_id=user_id, title=title, body=body, href=href)
