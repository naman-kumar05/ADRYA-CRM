import csv
import json
from datetime import timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.db.models import Count, Q, Sum
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .access import (
    can,
    customer_scope,
    followup_scope,
    lead_scope,
    loan_scope,
    requirement_scope,
)
from .constants import (
    CONTACTED_STATUSES,
    DEALER_LEAD_STATUSES,
    DEALER_STATUSES,
    DISBURSEMENT_PLUS,
    DOCUMENT_LEAD_STATUSES,
    DOCUMENT_STATUSES,
    DSA_CHECKLIST,
    DSA_PIPELINE,
    FOLLOWUP_RESULTS,
    FOLLOWUP_TYPES,
    INTERESTED_STATUSES,
    LEAD_STATUSES,
    LENDER_DECISION_NOTE,
    LOGIN_PLUS,
    LOAN_STATUSES,
    PARTNER_TYPES,
    PAYOUT_STATUSES,
    PRIORITIES,
    ROLES,
    SANCTION_PLUS,
    WHATSAPP_TEMPLATES,
)
from .http import aware, checked, clean_mobile, client_ip, money, rate_limit, require, safe_next, split_list
from .models import (
    AuditLog,
    Campaign,
    Customer,
    Dealer,
    Document,
    FinancePartner,
    FollowUp,
    Lead,
    LeadSource,
    LoanCase,
    LoginHistory,
    Notification,
    Payout,
    Product,
    Requirement,
    StatusOption,
    Territory,
    User,
    Vendor,
)
from .phone import fill_template, tel_href, whatsapp_href
from .services import (
    bulk_assign,
    complete_followup,
    create_followup,
    create_lead_record,
    create_loan_case,
    ensure_lead_checklist,
    ensure_stale_reminders,
    log_interaction,
    missing_required_docs,
    move_pipeline_stage,
    partner_fits,
    save_checklist_document,
    save_loan_document,
    save_payout,
    stale_cutoff,
    stored_file_path,
    update_lead_record,
    update_loan_case,
)


def home(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return redirect("login")


def login_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        password = request.POST.get("password") or ""
        if not email or not password:
            messages.error(request, "Enter your email and password.")
        elif not rate_limit(f"login:{email}", 8, 10 * 60):
            messages.error(request, "Too many attempts. Try again in a few minutes.")
        else:
            user = User.objects.filter(email__iexact=email).first()
            ok = bool(user and user.check_password(password) and user.is_active)
            LoginHistory.objects.create(user=user if ok else None, email=email, success=ok, ip=client_ip(request))
            if not ok:
                messages.error(request, "Invalid email or password.")
            else:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                return redirect(safe_next(request.POST.get("next"), "/dashboard/"))
    return render(request, "login.html", {"next": request.GET.get("next", "")})


@require_POST
def logout_view(request):
    logout(request)
    return redirect("login")


def dashboard(request):
    denied = require(request)
    if denied:
        return denied
    user = request.user
    if can(user.role, "followups.write"):
        ensure_stale_reminders(user)
    now = timezone.localtime()
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month = day.replace(day=1)
    tomorrow = day + timedelta(days=1)
    leads = Lead.objects.filter(lead_scope(user))
    loans = LoanCase.objects.filter(loan_scope(user))
    tasks = FollowUp.objects.filter(followup_scope(user))
    kpis = [
        ("Leads today", leads.filter(created_at__gte=day).aggregate(n=Count("id", distinct=True))["n"]),
        ("Follow-ups due", tasks.filter(completed_at__isnull=True, due_at__gte=day, due_at__lt=tomorrow).distinct().count()),
        ("Overdue", tasks.filter(completed_at__isnull=True, due_at__lt=now).distinct().count()),
        ("Login", loans.filter(status__in=LOGIN_PLUS).distinct().count()),
        ("Sanction", loans.filter(status__in=SANCTION_PLUS).distinct().count()),
        ("Disbursement", loans.filter(status__in=DISBURSEMENT_PLUS).distinct().count()),
    ]
    funnel = [
        ("Leads", leads.aggregate(n=Count("id", distinct=True))["n"]),
        ("Contacted", leads.filter(status__in=CONTACTED_STATUSES).aggregate(n=Count("id", distinct=True))["n"]),
        ("Interested", leads.filter(status__in=INTERESTED_STATUSES).aggregate(n=Count("id", distinct=True))["n"]),
        ("Documents", leads.filter(status__in=DOCUMENT_LEAD_STATUSES).aggregate(n=Count("id", distinct=True))["n"]),
    ]
    by_category = list(leads.values("category").annotate(value=Count("id", distinct=True)).order_by("-value"))
    by_source = list(leads.values("source").annotate(value=Count("id", distinct=True)).order_by("-value"))
    loan_ids = loans.values("id")
    expected = Payout.objects.filter(
        loan_case_id__in=loan_ids, status__in=["Expected", "Invoice", "Approved", "Pending"]
    ).aggregate(total=Sum("expected_payout"))["total"]
    received = Payout.objects.filter(loan_case_id__in=loan_ids, status="Received").aggregate(total=Sum("net_received"))["total"]
    due = tasks.filter(completed_at__isnull=True, due_at__lt=tomorrow).select_related("lead__customer").distinct()[:6]
    quiet = (
        leads.filter(stage_updated_at__lt=stale_cutoff())
        .exclude(pipeline_stage="Disbursed")
        .exclude(status__in=["Not Interested", "Closed"])
        .select_related("customer")
        .distinct()[:6]
    )
    return render(
        request,
        "dashboard.html",
        {
            "kpis": kpis,
            "funnel": funnel,
            "by_category": [{"label": row["category"], "value": row["value"]} for row in by_category],
            "by_source": [{"label": row["source"], "value": row["value"]} for row in by_source],
            "expected": expected,
            "received": received,
            "pending_docs": Document.objects.filter(status__in=["Pending", "Rejected"], loan_case_id__in=loan_ids).count(),
            "due": due,
            "quiet": quiet,
            "show_payouts": can(user.role, "payouts.read"),
        },
    )


def pipeline(request):
    denied = require(request, "leads.read")
    if denied:
        return denied
    q = (request.GET.get("q") or "").strip()
    leads = Lead.objects.filter(lead_scope(request.user)).select_related("customer").distinct()
    if q:
        leads = leads.filter(Q(customer__name__icontains=q) | Q(customer__mobile__icontains=q) | Q(code__icontains=q))
    columns = []
    for stage in DSA_PIPELINE:
        columns.append({"stage": stage, "leads": list(leads.filter(pipeline_stage=stage)[:40])})
    return render(
        request,
        "pipeline.html",
        {"columns": columns, "q": q, "stages": DSA_PIPELINE, "results": FOLLOWUP_RESULTS, "can_move": can(request.user.role, "leads.write")},
    )


def leads(request):
    denied = require(request, "leads.read")
    if denied:
        return denied
    if request.method == "POST":
        result = bulk_assign(request.user, request.POST.getlist("lead_ids"), request.POST.get("assigned_to") or None)
        messages.success(request, f"Assigned {result.get('count', 0)} leads.") if result.get("ok") else messages.error(request, result["error"])
        return redirect("leads")
    q = (request.GET.get("q") or "").strip()
    rows = Lead.objects.filter(lead_scope(request.user)).select_related("customer", "assigned_to").distinct()
    if q:
        rows = rows.filter(Q(customer__name__icontains=q) | Q(customer__mobile__icontains=q) | Q(code__icontains=q))
    return render(
        request,
        "leads.html",
        {
            "leads": rows[:80],
            "q": q,
            "assignees": User.objects.filter(is_active=True, role__in=["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN"]),
            "can_assign": can(request.user.role, "leads.assign"),
        },
    )


def _options():
    products = list(Product.objects.filter(active=True))
    return {
        "products": products,
        "sources": list(LeadSource.objects.filter(active=True)),
        "territories": list(Territory.objects.all()),
        "dealers": list(Dealer.objects.filter(status="Active")),
        "vendors": list(Vendor.objects.filter(status="Active")),
        "assignees": list(User.objects.filter(is_active=True, role__in=["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN"])),
        "priorities": PRIORITIES,
    }


def _lead_payload(request):
    post = request.POST
    product = Product.objects.filter(pk=post.get("product") or None, active=True).first()
    if not product:
        raise ValueError("Choose a product.")
    source = (post.get("source") or "").strip()
    if not LeadSource.objects.filter(name=source, active=True).exists():
        raise ValueError("Choose a source.")
    return {
        "name": (post.get("name") or "").strip(),
        "mobile": clean_mobile(post.get("mobile")),
        "alt_mobile": clean_mobile(post.get("alt_mobile")) if (post.get("alt_mobile") or "").strip() else "",
        "email": (post.get("email") or "").strip(),
        "occupation": (post.get("occupation") or "").strip(),
        "address": (post.get("address") or "").strip(),
        "state": (post.get("state") or "").strip(),
        "district": (post.get("district") or "").strip(),
        "city": (post.get("city") or "").strip(),
        "pincode": (post.get("pincode") or "").strip(),
        "source": source,
        "category": product.category,
        "product_name": product.name,
        "requirement_text": (post.get("requirement_text") or "").strip(),
        "budget": money(post.get("budget")),
        "loan_required": checked(post, "loan_required"),
        "loan_amount": money(post.get("loan_amount")),
        "priority": post.get("priority") if post.get("priority") in PRIORITIES else "WARM",
        "assigned_to_id": post.get("assigned_to") or None,
        "dealer_id": post.get("dealer") or None,
        "vendor_id": post.get("vendor") or None,
        "next_follow_up": aware(post.get("next_follow_up")),
        "remarks": (post.get("remarks") or "").strip(),
        "duplicate_choice": post.get("duplicate_choice") or "",
        "customer_id": post.get("customer_id") or None,
    }


def lead_new(request):
    denied = require(request, "leads.write")
    if denied:
        return denied
    duplicate = None
    if request.method == "POST":
        try:
            data = _lead_payload(request)
            if len(data["name"]) < 2 or len(data["state"]) < 2 or len(data["district"]) < 2 or len(data["city"]) < 2:
                raise ValueError("Name, state, district, and city are required.")
            result = create_lead_record(request.user, data)
        except ValueError as exc:
            messages.error(request, str(exc))
        else:
            if result.get("duplicate"):
                duplicate = result["duplicate"]
                messages.error(request, result["error"])
            elif not result["ok"]:
                messages.error(request, result["error"])
            else:
                messages.success(request, f"Lead {result['code']} created.")
                return redirect("lead-detail", lead_id=result["id"])
    context = _options()
    context.update(
        {
            "duplicate": duplicate,
            "posted": request.POST,
            "can_assign": can(request.user.role, "leads.assign"),
        }
    )
    return render(request, "lead_new.html", context)


def _lead_or_404(user, lead_id):
    lead = Lead.objects.filter(pk=lead_id).filter(lead_scope(user)).select_related("customer", "assigned_to", "dealer", "vendor").distinct().first()
    if not lead:
        raise Http404("Lead not found")
    return lead


def lead_detail(request, lead_id):
    denied = require(request, "leads.read")
    if denied:
        return denied
    lead = _lead_or_404(request.user, lead_id)
    if request.method == "POST" and request.POST.get("form") == "details":
        try:
            result = update_lead_record(
                request.user,
                lead.id,
                {
                    "status": request.POST.get("status") or None,
                    "priority": request.POST.get("priority") or None,
                    "assigned_to_id": request.POST.get("assigned_to") or None,
                    "dealer_id": request.POST.get("dealer") or None,
                    "vendor_id": request.POST.get("vendor") or None,
                    "remarks": request.POST.get("remarks") or "",
                    "loan_required": checked(request.POST, "loan_required"),
                    "loan_amount": money(request.POST.get("loan_amount")),
                    "requirement_text": request.POST.get("requirement_text") or "",
                    "next_follow_up": aware(request.POST.get("next_follow_up")),
                },
            )
        except ValueError as exc:
            messages.error(request, str(exc))
        else:
            messages.success(request, "Lead updated.") if result["ok"] else messages.error(request, result["error"])
        return redirect("lead-detail", lead_id=lead.id)
    ensure_lead_checklist(lead)
    checklist = list(lead.documents.filter(loan_case__isnull=True, doc_type__in=DSA_CHECKLIST))
    missing = missing_required_docs(checklist)
    values = {
        "name": lead.customer.name,
        "product": lead.product_name,
        "code": lead.code,
        "stage": lead.pipeline_stage,
        "missing": ", ".join(missing),
    }
    templates = []
    for item in WHATSAPP_TEMPLATES:
        text = fill_template(item["text"], values)
        templates.append({"id": item["id"], "label": item["label"], "text": text})
    partners = []
    for partner in FinancePartner.objects.filter(status="Active"):
        partners.append(
            {
                "partner": partner,
                "fits": partner_fits(partner, lead.category, lead.product_name, lead.state, lead.loan_amount or 0),
            }
        )
    return render(
        request,
        "lead_detail.html",
        {
            "lead": lead,
            "tel": tel_href(lead.customer.mobile),
            "checklist": checklist,
            "missing": missing,
            "templates": templates,
            "stages": DSA_PIPELINE,
            "statuses": LEAD_STATUSES,
            "priorities": PRIORITIES,
            "doc_statuses": DOCUMENT_STATUSES,
            "results": FOLLOWUP_RESULTS,
            "followup_types": FOLLOWUP_TYPES,
            "dealer_statuses": DEALER_LEAD_STATUSES,
            "partners": partners,
            "executives": User.objects.filter(is_active=True, role__in=["FINANCE_EXECUTIVE", "FINANCE_MANAGER"]),
            "assignees": User.objects.filter(is_active=True, role__in=["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN"]),
            "dealers": Dealer.objects.filter(status="Active"),
            "vendors": Vendor.objects.filter(status="Active"),
            "followups": lead.follow_ups.select_related("assignee")[:12],
            "loans": lead.loan_cases.all(),
            "can_write": can(request.user.role, "leads.write"),
            "can_assign": can(request.user.role, "leads.assign"),
            "can_docs": can(request.user.role, "documents.write"),
            "can_follow": can(request.user.role, "followups.write"),
            "can_loan": can(request.user.role, "loans.create"),
            "can_dealer_status": can(request.user.role, "dealer.status"),
        },
    )


@require_POST
def move_stage(request, lead_id):
    denied = require(request, "leads.write")
    if denied:
        return denied
    result = move_pipeline_stage(request.user, lead_id, request.POST.get("pipeline_stage") or "")
    messages.success(request, "Stage updated.") if result.get("ok") else messages.error(request, result["error"])
    return redirect(safe_next(request.POST.get("next"), f"/leads/{lead_id}/"))


@require_POST
def log_call(request, lead_id):
    denied = require(request, "followups.write")
    if denied:
        return denied
    result_name = request.POST.get("result") or "Connected"
    if result_name not in FOLLOWUP_RESULTS:
        messages.error(request, "Choose a result.")
        return redirect("lead-detail", lead_id=lead_id)
    result = log_interaction(request.user, lead_id, request.POST.get("type") or "Call", result_name, request.POST.get("notes") or "")
    messages.success(request, "Interaction logged.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("lead-detail", lead_id=lead_id)


@require_POST
def send_whatsapp(request, lead_id):
    denied = require(request, "followups.write")
    if denied:
        return denied
    label = request.POST.get("label") or "WhatsApp"
    text = request.POST.get("text") or ""
    result = log_interaction(request.user, lead_id, "WhatsApp", "Connected", f"WhatsApp template sent: {label}. {text}".strip())
    if not result.get("ok"):
        messages.error(request, result["error"])
        return redirect("lead-detail", lead_id=lead_id)
    return redirect(whatsapp_href(result["lead"].customer.mobile, text))


@require_POST
def save_checklist(request, lead_id):
    denied = require(request, "documents.write")
    if denied:
        return denied
    status = request.POST.get("status") or "Pending"
    if status not in DOCUMENT_STATUSES:
        messages.error(request, "Unknown document status.")
        return redirect("lead-detail", lead_id=lead_id)
    try:
        result = save_checklist_document(
            request.user,
            lead_id,
            request.POST.get("doc_type") or "",
            status,
            request.FILES.get("file"),
            request.POST.get("notes") or "",
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("lead-detail", lead_id=lead_id)
    messages.success(request, "Checklist updated.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("lead-detail", lead_id=lead_id)


@require_POST
def dealer_status(request, lead_id):
    denied = require(request, "dealer.status")
    if denied:
        return denied
    status = request.POST.get("dealer_status") or ""
    if status not in DEALER_LEAD_STATUSES:
        messages.error(request, "Unknown dealer status.")
        return redirect("lead-detail", lead_id=lead_id)
    result = update_lead_record(request.user, lead_id, {"dealer_status": status})
    messages.success(request, "Dealer status saved.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("lead-detail", lead_id=lead_id)


@require_POST
def open_loan(request, lead_id):
    denied = require(request, "loans.create")
    if denied:
        return denied
    try:
        amount = money(request.POST.get("loan_amount"))
        if amount is None or amount <= 0:
            raise ValueError("Enter the loan amount.")
        result = create_loan_case(
            request.user,
            {
                "lead_id": lead_id,
                "lender_id": request.POST.get("lender") or None,
                "executive_id": request.POST.get("executive") or None,
                "loan_type": (request.POST.get("loan_type") or "New").strip(),
                "loan_amount": amount,
                "remarks": request.POST.get("remarks") or "",
            },
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("lead-detail", lead_id=lead_id)
    if not result["ok"]:
        messages.error(request, result["error"])
        return redirect("lead-detail", lead_id=lead_id)
    messages.success(request, f"Case {result['code']} opened.")
    return redirect("loan-detail", loan_id=result["id"])


@require_POST
def add_followup(request, lead_id):
    denied = require(request, "followups.write")
    if denied:
        return denied
    kind = request.POST.get("type") or "Call"
    if kind not in FOLLOWUP_TYPES:
        messages.error(request, "Unknown follow-up type.")
        return redirect("lead-detail", lead_id=lead_id)
    try:
        due = aware(request.POST.get("due_at"))
        if due is None:
            raise ValueError("Choose when to follow up.")
        result = create_followup(
            request.user,
            {"lead_id": lead_id, "type": kind, "due_at": due, "notes": request.POST.get("notes") or ""},
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("lead-detail", lead_id=lead_id)
    messages.success(request, "Follow-up added.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("lead-detail", lead_id=lead_id)


def customers(request):
    denied = require(request, "customers.read")
    if denied:
        return denied
    if request.user.role in {"DEALER", "VENDOR"}:
        return render(request, "forbidden.html", status=403)
    q = (request.GET.get("q") or "").strip()
    rows = Customer.objects.filter(customer_scope(request.user)).distinct()
    if q:
        rows = rows.filter(Q(name__icontains=q) | Q(mobile__icontains=q) | Q(code__icontains=q))
    return render(request, "customers.html", {"customers": rows.order_by("-created_at")[:80], "q": q})


def customer_detail(request, customer_id):
    denied = require(request, "customers.read")
    if denied:
        return denied
    customer = Customer.objects.filter(pk=customer_id).filter(customer_scope(request.user)).distinct().first()
    if not customer:
        raise Http404("Customer not found")
    leads = customer.leads.filter(lead_scope(request.user)).distinct()
    return render(request, "customer_detail.html", {"customer": customer, "leads": leads, "tel": tel_href(customer.mobile)})


def requirements(request):
    denied = require(request)
    if denied:
        return denied
    if request.user.role not in {"SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE", "FINANCE_MANAGER", "MANAGEMENT"}:
        return render(request, "forbidden.html", status=403)
    rows = Requirement.objects.filter(requirement_scope(request.user)).select_related("customer").distinct()[:80]
    return render(request, "requirements.html", {"requirements": rows})


def dealers(request):
    denied = require(request, "dealers.read")
    if denied:
        return denied
    if request.method == "POST":
        if not can(request.user.role, "dealers.write"):
            return render(request, "forbidden.html", status=403)
        try:
            _create_dealer(request)
        except ValueError as exc:
            messages.error(request, str(exc))
        else:
            messages.success(request, "Dealer added.")
        return redirect("dealers")
    return render(
        request,
        "dealers.html",
        {"dealers": Dealer.objects.all(), "can_write": can(request.user.role, "dealers.write"), "statuses": DEALER_STATUSES},
    )


def _create_dealer(request):
    post = request.POST
    company = (post.get("company_name") or "").strip()
    contact = (post.get("contact_name") or "").strip()
    if len(company) < 2 or len(contact) < 2:
        raise ValueError("Company and contact name are required.")
    from django.db import transaction

    from .services import next_code

    with transaction.atomic():
        Dealer.objects.create(
            code=next_code("dealer", "ADY-DL", 4),
            company_name=company,
            brands=split_list(post.get("brands")),
            contact_name=contact,
            mobile=clean_mobile(post.get("mobile")),
            email=(post.get("email") or "").strip(),
            state=(post.get("state") or "").strip(),
            district=(post.get("district") or "").strip(),
            city=(post.get("city") or "").strip(),
            territory=(post.get("territory") or "").strip(),
            products=split_list(post.get("products")),
            agreement_status=post.get("agreement_status") or "Pending",
            payout_terms=(post.get("payout_terms") or "").strip(),
            status=post.get("status") if post.get("status") in DEALER_STATUSES else "New",
        )


def dealer_detail(request, dealer_id):
    denied = require(request, "dealers.read")
    if denied:
        return denied
    dealer = get_object_or_404(Dealer, pk=dealer_id)
    leads = Lead.objects.filter(dealer=dealer).filter(lead_scope(request.user)).select_related("customer").distinct()
    return render(request, "dealer_detail.html", {"dealer": dealer, "leads": leads, "tel": tel_href(dealer.mobile)})


def vendors(request):
    denied = require(request, "vendors.read")
    if denied:
        return denied
    if request.method == "POST":
        if not can(request.user.role, "vendors.write"):
            return render(request, "forbidden.html", status=403)
        try:
            _create_vendor(request)
        except ValueError as exc:
            messages.error(request, str(exc))
        else:
            messages.success(request, "Vendor added.")
        return redirect("vendors")
    return render(request, "vendors.html", {"vendors": Vendor.objects.all(), "can_write": can(request.user.role, "vendors.write")})


def _create_vendor(request):
    post = request.POST
    company = (post.get("company_name") or "").strip()
    if len(company) < 2:
        raise ValueError("Company name is required.")
    from django.db import transaction

    from .services import next_code

    with transaction.atomic():
        Vendor.objects.create(
            code=next_code("vendor", "ADY-VN", 4),
            company_name=company,
            contact_name=(post.get("contact_name") or "").strip(),
            mobile=clean_mobile(post.get("mobile")),
            email=(post.get("email") or "").strip(),
            service_area=(post.get("service_area") or "").strip(),
            products=split_list(post.get("products")),
            capacity=(post.get("capacity") or "").strip(),
            install_capability=(post.get("install_capability") or "").strip(),
            pricing_reference=(post.get("pricing_reference") or "").strip(),
            payout_terms=(post.get("payout_terms") or "").strip(),
            status="Active",
            state=(post.get("state") or "").strip(),
            district=(post.get("district") or "").strip(),
            city=(post.get("city") or "").strip(),
        )


def partners(request):
    denied = require(request, "partners.read")
    if denied:
        return denied
    if request.method == "POST":
        if not can(request.user.role, "partners.write"):
            return render(request, "forbidden.html", status=403)
        try:
            _create_partner(request)
        except ValueError as exc:
            messages.error(request, str(exc))
        else:
            messages.success(request, "Finance partner added.")
        return redirect("partners")
    return render(
        request,
        "partners.html",
        {"partners": FinancePartner.objects.all(), "can_write": can(request.user.role, "partners.write"), "types": PARTNER_TYPES},
    )


def _create_partner(request):
    post = request.POST
    name = (post.get("name") or "").strip()
    if len(name) < 2:
        raise ValueError("Partner name is required.")
    minimum = money(post.get("amount_min"))
    maximum = money(post.get("amount_max"))
    if minimum is None or maximum is None:
        raise ValueError("Enter the minimum and maximum amount.")
    from django.db import transaction

    from .services import next_code

    with transaction.atomic():
        FinancePartner.objects.create(
            code=next_code("partner", "ADY-FP", 4),
            name=name,
            partner_type=post.get("partner_type") if post.get("partner_type") in PARTNER_TYPES else "Other",
            products=split_list(post.get("products")),
            states=split_list(post.get("states")),
            loan_types=split_list(post.get("loan_types")),
            amount_min=minimum,
            amount_max=maximum,
            document_checklist=(post.get("document_checklist") or "").strip(),
            rm_name=(post.get("rm_name") or "").strip(),
            rm_mobile=(post.get("rm_mobile") or "").strip(),
            payout_terms=(post.get("payout_terms") or "").strip(),
            status="Active",
        )


def partner_detail(request, partner_id):
    denied = require(request, "partners.read")
    if denied:
        return denied
    partner = get_object_or_404(FinancePartner, pk=partner_id)
    cases = LoanCase.objects.filter(lender=partner).filter(loan_scope(request.user)).distinct()
    return render(request, "partner_detail.html", {"partner": partner, "cases": cases})


def loans(request):
    denied = require(request, "loans.read")
    if denied:
        return denied
    if request.user.role == "DEALER":
        return render(request, "forbidden.html", status=403)
    rows = LoanCase.objects.filter(loan_scope(request.user)).select_related("customer", "lender", "executive").distinct()[:80]
    return render(request, "loans.html", {"loans": rows, "note": LENDER_DECISION_NOTE})


def loan_detail(request, loan_id):
    denied = require(request, "loans.read")
    if denied:
        return denied
    loan = LoanCase.objects.filter(pk=loan_id).filter(loan_scope(request.user)).select_related("customer", "lender", "lead", "executive").distinct().first()
    if not loan:
        raise Http404("Loan case not found")
    return render(
        request,
        "loan_detail.html",
        {
            "loan": loan,
            "events": loan.events.all(),
            "documents": loan.documents.all(),
            "payouts": loan.payouts.all(),
            "statuses": LOAN_STATUSES,
            "doc_statuses": DOCUMENT_STATUSES,
            "payout_statuses": PAYOUT_STATUSES,
            "note": LENDER_DECISION_NOTE,
            "tel": tel_href(loan.customer.mobile),
            "can_update": can(request.user.role, "loans.update"),
            "can_docs": can(request.user.role, "documents.write"),
            "can_payout": can(request.user.role, "payouts.write"),
            "executives": User.objects.filter(is_active=True, role__in=["FINANCE_EXECUTIVE", "FINANCE_MANAGER"]),
            "partners": FinancePartner.objects.filter(status="Active"),
        },
    )


@require_POST
def update_loan(request, loan_id):
    denied = require(request, "loans.update")
    if denied:
        return denied
    status = request.POST.get("status") or ""
    if status not in LOAN_STATUSES:
        messages.error(request, "Unknown case status.")
        return redirect("loan-detail", loan_id=loan_id)
    try:
        payload = {
            "status": status,
            "note": request.POST.get("note") or "",
            "application_number": request.POST.get("application_number") or "",
            "executive_id": request.POST.get("executive") or None,
            "lender_id": request.POST.get("lender") or None,
            "query_note": request.POST.get("query_note") or "",
        }
        if (request.POST.get("sanction_amount") or "").strip():
            payload["sanction_amount"] = money(request.POST.get("sanction_amount"))
        if (request.POST.get("disbursement_amount") or "").strip():
            payload["disbursement_amount"] = money(request.POST.get("disbursement_amount"))
        for field in ("login_date", "sanction_date", "disbursement_date"):
            if (request.POST.get(field) or "").strip():
                payload[field] = aware(request.POST.get(field))
        result = update_loan_case(request.user, loan_id, payload)
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("loan-detail", loan_id=loan_id)
    messages.success(request, "Case updated.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("loan-detail", loan_id=loan_id)


@require_POST
def save_case_document(request, loan_id):
    denied = require(request, "documents.write")
    if denied:
        return denied
    status = request.POST.get("status") or "Pending"
    if status not in DOCUMENT_STATUSES:
        messages.error(request, "Unknown document status.")
        return redirect("loan-detail", loan_id=loan_id)
    try:
        result = save_loan_document(
            request.user,
            loan_id,
            request.POST.get("doc_type") or "",
            status,
            request.FILES.get("file"),
            request.POST.get("notes") or "",
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("loan-detail", loan_id=loan_id)
    messages.success(request, "Document updated.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("loan-detail", loan_id=loan_id)


@require_POST
def record_payout(request, loan_id):
    denied = require(request, "payouts.write")
    if denied:
        return denied
    status = request.POST.get("status") or "Expected"
    if status not in PAYOUT_STATUSES:
        messages.error(request, "Unknown payout status.")
        return redirect("loan-detail", loan_id=loan_id)
    try:
        result = save_payout(
            request.user,
            {
                "loan_case_id": loan_id,
                "partner_kind": (request.POST.get("partner_kind") or "Lender").strip(),
                "partner_name": (request.POST.get("partner_name") or "").strip(),
                "transaction_amount": money(request.POST.get("transaction_amount")),
                "expected_payout": money(request.POST.get("expected_payout")),
                "actual_payout": money(request.POST.get("actual_payout")),
                "invoice_no": request.POST.get("invoice_no") or "",
                "deductions": money(request.POST.get("deductions")) or 0,
                "payout_date": aware(request.POST.get("payout_date")),
                "status": status,
                "notes": request.POST.get("notes") or "",
            },
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("loan-detail", loan_id=loan_id)
    if not result["ok"]:
        messages.error(request, result["error"])
    else:
        messages.success(request, "Payout recorded.")
    return redirect("loan-detail", loan_id=loan_id)


def followups(request):
    denied = require(request, "followups.read")
    if denied:
        return denied
    now = timezone.now()
    rows = FollowUp.objects.filter(followup_scope(request.user)).select_related("lead__customer", "assignee").distinct()
    return render(
        request,
        "followups.html",
        {
            "open_items": rows.filter(completed_at__isnull=True).order_by("due_at")[:80],
            "done_items": rows.filter(completed_at__isnull=False).order_by("-completed_at")[:20],
            "now": now,
            "results": FOLLOWUP_RESULTS,
            "can_write": can(request.user.role, "followups.write"),
        },
    )


@require_POST
def finish_followup(request, followup_id):
    denied = require(request, "followups.write")
    if denied:
        return denied
    result_name = request.POST.get("result") or "Connected"
    if result_name not in FOLLOWUP_RESULTS:
        messages.error(request, "Choose a result.")
        return redirect("followups")
    result = complete_followup(request.user, followup_id, result_name, request.POST.get("notes") or "")
    messages.success(request, "Follow-up closed.") if result.get("ok") else messages.error(request, result["error"])
    return redirect("followups")


def payouts(request):
    denied = require(request, "payouts.read")
    if denied:
        return denied
    rows = Payout.objects.filter(loan_case__in=LoanCase.objects.filter(loan_scope(request.user))).select_related("loan_case__customer")
    return render(request, "payouts.html", {"payouts": rows[:80]})


def reports(request):
    denied = require(request, "reports.read")
    if denied:
        return denied
    leads = Lead.objects.filter(lead_scope(request.user))
    by_status = list(leads.values("status").annotate(value=Count("id", distinct=True)).order_by("-value"))
    by_stage = list(leads.values("pipeline_stage").annotate(value=Count("id", distinct=True)).order_by("-value"))
    return render(request, "reports.html", {"by_status": by_status, "by_stage": by_stage})


def leads_csv(request):
    denied = require(request, "reports.read")
    if denied:
        return denied
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="leads.csv"'
    writer = csv.writer(response)
    writer.writerow(["Code", "Customer", "Mobile", "Source", "Category", "Product", "Status", "Pipeline", "City", "State", "Created"])
    rows = Lead.objects.filter(lead_scope(request.user)).select_related("customer").distinct().order_by("-created_at")
    for lead in rows:
        writer.writerow(
            [
                lead.code,
                lead.customer.name,
                lead.customer.mobile,
                lead.source,
                lead.category,
                lead.product_name,
                lead.status,
                lead.pipeline_stage,
                lead.city,
                lead.state,
                timezone.localtime(lead.created_at).strftime("%Y-%m-%d"),
            ]
        )
    return response


def settings_page(request):
    denied = require(request, "settings.read")
    if denied:
        return denied
    if request.method == "POST":
        if not can(request.user.role, "settings.write"):
            return render(request, "forbidden.html", status=403)
        try:
            _settings_action(request)
        except ValueError as exc:
            messages.error(request, str(exc))
        return redirect("settings")
    return render(
        request,
        "settings.html",
        {
            "people": User.objects.order_by("name"),
            "products": Product.objects.all(),
            "sources": LeadSource.objects.all(),
            "statuses": StatusOption.objects.all(),
            "territories": Territory.objects.all(),
            "campaigns": Campaign.objects.all(),
            "roles": ROLES,
            "dealers": Dealer.objects.all(),
            "vendors": Vendor.objects.all(),
        },
    )


def _settings_action(request):
    from .services import write_audit

    kind = request.POST.get("form")
    if kind == "user":
        name = (request.POST.get("name") or "").strip()
        email = (request.POST.get("email") or "").strip().lower()
        password = request.POST.get("password") or ""
        role = request.POST.get("role") or ""
        if len(name) < 2 or "@" not in email or len(password) < 8 or role not in ROLES:
            raise ValueError("Name, email, a role, and a password of 8 or more characters are required.")
        if User.objects.filter(email__iexact=email).exists():
            raise ValueError("That email is already a user.")
        user = User(
            name=name,
            email=email,
            role=role,
            dealer_id=request.POST.get("dealer") or None,
            vendor_id=request.POST.get("vendor") or None,
        )
        user.set_password(password)
        user.save()
        write_audit(request.user, "user", user.id, "user.create", [{"field": "role", "new": role}])
        messages.success(request, f"{name} can sign in.")
        return
    if kind == "password":
        person = User.objects.filter(pk=request.POST.get("user") or None).first()
        password = request.POST.get("password") or ""
        if not person or len(password) < 8:
            raise ValueError("Choose a person and a password of 8 or more characters.")
        person.set_password(password)
        person.save(update_fields=["password"])
        write_audit(request.user, "user", person.id, "user.password", [{"field": "password", "new": "reset"}])
        messages.success(request, f"Password updated for {person.name}.")
        return
    if kind == "active":
        person = User.objects.filter(pk=request.POST.get("user") or None).first()
        if not person:
            raise ValueError("Choose a person.")
        person.is_active = request.POST.get("active") == "yes"
        person.save(update_fields=["is_active"])
        messages.success(request, f"{person.name} is {'active' if person.is_active else 'inactive'}.")
        return
    if kind == "product":
        category = (request.POST.get("category") or "").strip()
        name = (request.POST.get("name") or "").strip()
        if len(category) < 2 or len(name) < 2:
            raise ValueError("Category and product name are required.")
        Product.objects.get_or_create(category=category, name=name)
        messages.success(request, "Product saved.")
        return
    if kind == "source":
        name = (request.POST.get("name") or "").strip()
        if len(name) < 2:
            raise ValueError("Source name is required.")
        LeadSource.objects.get_or_create(name=name)
        messages.success(request, "Source saved.")
        return
    if kind == "status":
        entity = request.POST.get("entity") or "lead"
        name = (request.POST.get("name") or "").strip()
        if entity not in {"lead", "loan"} or len(name) < 2:
            raise ValueError("Choose lead or loan, and a status name.")
        sort = StatusOption.objects.filter(entity=entity).count()
        StatusOption.objects.get_or_create(entity=entity, name=name, defaults={"sort": sort})
        messages.success(request, "Status saved.")
        return
    if kind == "territory":
        state = (request.POST.get("state") or "").strip()
        district = (request.POST.get("district") or "").strip()
        city = (request.POST.get("city") or "").strip()
        if len(state) < 2 or len(district) < 2 or len(city) < 2:
            raise ValueError("State, district, and city are required.")
        Territory.objects.get_or_create(state=state, district=district, city=city)
        messages.success(request, "Territory saved.")
        return
    if kind == "campaign":
        name = (request.POST.get("name") or "").strip()
        source = (request.POST.get("source") or "").strip()
        if len(name) < 2 or len(source) < 2:
            raise ValueError("Campaign name and source are required.")
        Campaign.objects.create(name=name, source=source, spend=money(request.POST.get("spend")) or 0)
        messages.success(request, "Campaign saved.")
        return
    raise ValueError("Unknown settings form.")


def audit(request):
    denied = require(request, "audit.read")
    if denied:
        return denied
    rows = AuditLog.objects.select_related("user")[:200]
    return render(request, "audit.html", {"rows": rows})


def notifications(request):
    denied = require(request)
    if denied:
        return denied
    if request.method == "POST":
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return redirect("notifications")
    rows = Notification.objects.filter(user=request.user)[:50]
    return render(request, "notifications.html", {"rows": rows})


def download_document(request, document_id):
    denied = require(request)
    if denied:
        return denied
    document = Document.objects.filter(pk=document_id).first()
    if not document or not document.storage_key:
        raise Http404("Document not found")
    allowed = False
    if document.lead_id and Lead.objects.filter(pk=document.lead_id).filter(lead_scope(request.user)).exists():
        allowed = True
    if document.loan_case_id and LoanCase.objects.filter(pk=document.loan_case_id).filter(loan_scope(request.user)).exists():
        allowed = True
    if not allowed:
        raise Http404("Document not found")
    try:
        path = stored_file_path(document.storage_key)
    except ValueError as exc:
        raise Http404("Document not found") from exc
    if not path.exists():
        raise Http404("Document not found")
    return FileResponse(path.open("rb"), as_attachment=True, filename=document.file_name or "document")


@csrf_exempt
@require_POST
def intake(request):
    if not settings.INTAKE_API_KEY or request.headers.get("X-Api-Key") != settings.INTAKE_API_KEY:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    if not rate_limit("intake", 60, 60):
        return JsonResponse({"error": "Too many requests"}, status=429)
    try:
        body = json.loads(request.body.decode() or "null")
    except (json.JSONDecodeError, UnicodeDecodeError):
        body = None
    if not isinstance(body, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    try:
        mobile = clean_mobile(str(body.get("mobile") or ""))
        name = str(body.get("name") or "").strip()
        category = str(body.get("category") or "").strip()
        product_name = str(body.get("productName") or "").strip()
        state = str(body.get("state") or "").strip()
        district = str(body.get("district") or "").strip()
        city = str(body.get("city") or "").strip()
        if min(len(name), len(category), len(product_name), len(state), len(district), len(city)) < 2:
            raise ValueError("Name, product, and location are required.")
        source = str(body.get("source") or "Website").strip() or "Website"
        amount = body.get("loanAmount")
        loan_amount = money(str(amount)) if amount not in (None, "") else None
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    actor = User.objects.filter(role="ADMIN", is_active=True).order_by("created_at").first()
    if not actor:
        return JsonResponse({"error": "CRM is not ready"}, status=503)
    result = create_lead_record(
        actor,
        {
            "name": name,
            "mobile": mobile,
            "source": source,
            "category": category,
            "product_name": product_name,
            "state": state,
            "district": district,
            "city": city,
            "loan_required": bool(body.get("loanRequired")),
            "loan_amount": loan_amount,
            "requirement_text": str(body.get("requirementText") or ""),
            "budget": None,
            "priority": "WARM",
            "duplicate_choice": "lead",
            "assigned_to_id": None,
        },
    )
    if not result["ok"]:
        return JsonResponse({"error": result["error"]}, status=422)
    return JsonResponse({"leadId": result["code"], "id": str(result["id"])})
