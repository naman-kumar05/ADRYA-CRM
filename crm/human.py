from decimal import Decimal

from .constants import ROLE_LABELS


def role_label(role):
    return ROLE_LABELS.get(role, role.replace("_", " ").title())


def inr(amount):
    if amount is None or amount == "":
        return "—"
    value = Decimal(amount)
    sign = "-" if value < 0 else ""
    whole, frac = f"{abs(value):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.append(head[-2:])
            head = head[:-2]
        if head:
            parts.append(head)
        whole = ",".join(reversed(parts)) + "," + tail
    if frac == "00":
        return f"{sign}₹{whole}"
    return f"{sign}₹{whole}.{frac}"
