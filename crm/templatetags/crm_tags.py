from django import template

from crm.human import inr as format_inr

register = template.Library()


@register.filter
def inr(value):
    return format_inr(value)


@register.filter
def join_list(value):
    if not value:
        return "—"
    return ", ".join(value)


@register.filter
def index(sequence, i):
    try:
        return sequence[i]
    except (IndexError, TypeError, KeyError):
        return ""
