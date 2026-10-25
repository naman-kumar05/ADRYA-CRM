from django.db.models import Q

from .constants import ROLES

ACTIONS = {
    "leads.read": ROLES,
    "leads.write": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE"],
    "leads.assign": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
    "dealer.status": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "DEALER"],
    "customers.read": ROLES,
    "customers.write": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE"],
    "dealers.read": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "MANAGEMENT", "ACCOUNTS", "FINANCE_MANAGER"],
    "dealers.write": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
    "vendors.read": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "MANAGEMENT", "FINANCE_MANAGER"],
    "vendors.write": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
    "partners.read": ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "FINANCE_EXECUTIVE", "MANAGEMENT", "SALES_MANAGER"],
    "partners.write": ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"],
    "loans.read": [
        "SUPER_ADMIN",
        "ADMIN",
        "FINANCE_MANAGER",
        "FINANCE_EXECUTIVE",
        "SALES_MANAGER",
        "SALES_EXECUTIVE",
        "MANAGEMENT",
        "ACCOUNTS",
        "DEALER",
    ],
    "loans.create": ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "SALES_MANAGER", "SALES_EXECUTIVE"],
    "loans.update": ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "FINANCE_EXECUTIVE"],
    "documents.write": [
        "SUPER_ADMIN",
        "ADMIN",
        "FINANCE_MANAGER",
        "FINANCE_EXECUTIVE",
        "SALES_MANAGER",
        "SALES_EXECUTIVE",
    ],
    "followups.read": ROLES,
    "followups.write": [
        "SUPER_ADMIN",
        "ADMIN",
        "SALES_MANAGER",
        "SALES_EXECUTIVE",
        "FINANCE_MANAGER",
        "FINANCE_EXECUTIVE",
        "DEALER",
        "VENDOR",
    ],
    "payouts.read": ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "FINANCE_MANAGER", "MANAGEMENT"],
    "payouts.write": ["SUPER_ADMIN", "ADMIN", "ACCOUNTS"],
    "reports.read": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "FINANCE_MANAGER", "ACCOUNTS", "MANAGEMENT"],
    "settings.read": ["SUPER_ADMIN", "ADMIN"],
    "settings.write": ["SUPER_ADMIN", "ADMIN"],
    "audit.read": ["SUPER_ADMIN", "ADMIN", "MANAGEMENT"],
}


def can(role, action):
    return role in ACTIONS.get(action, [])


def sees_full_history(role):
    return role in {"SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "MANAGEMENT", "FINANCE_MANAGER", "ACCOUNTS"}


def nav_for(role):
    items = [
        ("/dashboard/", "Dashboard", True),
        ("/pipeline/", "Pipeline", can(role, "leads.read")),
        ("/leads/", "Leads", can(role, "leads.read")),
        ("/customers/", "Customers", can(role, "customers.read") and role not in {"DEALER", "VENDOR"}),
        (
            "/requirements/",
            "Requirements",
            role in {"SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE", "FINANCE_MANAGER", "MANAGEMENT"},
        ),
        ("/follow-ups/", "Follow-ups", can(role, "followups.read") and role not in {"ACCOUNTS", "MANAGEMENT"}),
        ("/dealers/", "Dealers", can(role, "dealers.read")),
        ("/vendors/", "Vendors", can(role, "vendors.read")),
        ("/partners/", "Finance partners", can(role, "partners.read")),
        ("/loans/", "Loan cases", can(role, "loans.read") and role != "DEALER"),
        ("/payouts/", "Payouts", can(role, "payouts.read")),
        ("/reports/", "Reports", can(role, "reports.read")),
        ("/settings/", "Settings", can(role, "settings.read")),
        ("/audit/", "Audit log", can(role, "audit.read")),
    ]
    return [{"href": href, "label": label} for href, label, show in items if show]


def _none():
    return Q(pk__in=[])


def lead_scope(user):
    if user.role == "SALES_EXECUTIVE":
        return Q(assigned_to=user)
    if user.role == "DEALER":
        return Q(dealer_id=user.dealer_id) if user.dealer_id else _none()
    if user.role == "VENDOR":
        return Q(vendor_id=user.vendor_id) if user.vendor_id else _none()
    if user.role == "FINANCE_EXECUTIVE":
        return Q(loan_cases__executive=user)
    return Q()


def customer_scope(user):
    if user.role == "SALES_EXECUTIVE":
        return Q(leads__assigned_to=user)
    if user.role == "DEALER":
        return Q(leads__dealer_id=user.dealer_id) if user.dealer_id else _none()
    if user.role == "VENDOR":
        return Q(leads__vendor_id=user.vendor_id) if user.vendor_id else _none()
    if user.role == "FINANCE_EXECUTIVE":
        return Q(loan_cases__executive=user)
    return Q()


def loan_scope(user):
    if user.role == "SALES_EXECUTIVE":
        return Q(lead__assigned_to=user)
    if user.role == "FINANCE_EXECUTIVE":
        return Q(executive=user)
    if user.role == "DEALER":
        return Q(dealer_id=user.dealer_id) if user.dealer_id else _none()
    if user.role == "VENDOR":
        return _none()
    return Q()


def followup_scope(user):
    if user.role in {"SALES_EXECUTIVE", "FINANCE_EXECUTIVE"}:
        return Q(assignee=user)
    if user.role == "DEALER":
        return Q(lead__dealer_id=user.dealer_id) if user.dealer_id else _none()
    if user.role == "VENDOR":
        return Q(lead__vendor_id=user.vendor_id) if user.vendor_id else _none()
    return Q()


def requirement_scope(user):
    if user.role == "SALES_EXECUTIVE":
        return Q(lead__assigned_to=user)
    if user.role == "FINANCE_EXECUTIVE":
        return Q(loan_cases__executive=user)
    if user.role == "DEALER":
        return Q(lead__dealer_id=user.dealer_id) if user.dealer_id else _none()
    if user.role == "VENDOR":
        return Q(lead__vendor_id=user.vendor_id) if user.vendor_id else _none()
    return Q()
