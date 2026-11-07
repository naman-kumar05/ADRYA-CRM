from django import template

from crm.human import inr as format_inr
from crm.services import stale_cutoff

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


@register.filter
def is_stale(lead):
    closed = {"Disbursed", "Not Interested", "Closed"}
    if lead.pipeline_stage in closed:
        return False
    return lead.stage_updated_at < stale_cutoff()
