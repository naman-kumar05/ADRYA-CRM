from .access import can, nav_for
from .human import role_label
from .models import Notification


def shell(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {}
    bottom = [item for item in nav_for(user.role) if item["href"] in {"/pipeline/", "/leads/", "/follow-ups/"}]
    more = [item for item in nav_for(user.role) if item not in bottom and item["href"] != "/dashboard/"]
    return {
        "nav": nav_for(user.role),
        "bottom_nav": bottom,
        "more_nav": more,
        "unread": Notification.objects.filter(user=user, read=False).count(),
        "role_label": role_label(user.role),
        "can_write_leads": can(user.role, "leads.write"),
    }
