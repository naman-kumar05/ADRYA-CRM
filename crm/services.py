import re
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .access import can, followup_scope, lead_scope, loan_scope
from .constants import (
    DISBURSEMENT_PLUS,
    DOCUMENT_TYPES,
    DSA_CHECKLIST,
    DSA_PIPELINE,
    DSA_REQUIRED_DOCS,
    READY_DOC_STATUSES,
    STALE_FILE_HOURS,
    STATUS_FOR_STAGE,
)
from .models import (
    AuditLog,
    Counter,
    Customer,
    Document,
    FinancePartner,
    FollowUp,
    Lead,
    LoanCase,
    Notification,
    Payout,
    Requirement,
    StatusEvent,
)

ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MONEY = Decimal("0.01")


def text_value(value):
    if value is None:
        return ""
    return str(value)


def write_audit(user, entity, entity_id, action, changes=None):
    rows = changes or [{"field": action, "old": None, "new": None}]
    AuditLog.objects.bulk_create(
        [
            AuditLog(
                user=user,
                entity=entity,
                entity_id=str(entity_id),
                action=action,
                field=row.get("field") or "",
                old_value=text_value(row.get("old")),
                new_value=text_value(row.get("new")),
            )
            for row in rows
        ]
    )


def next_code(key, prefix, width):
    year = timezone.localdate().year
    counter_id = f"{key}-{year}"
    Counter.objects.get_or_create(id=counter_id, defaults={"value": 0})
    row = Counter.objects.select_for_update().get(id=counter_id)
    row.value += 1
    row.save(update_fields=["value"])
    return f"{prefix}-{year}-{row.value:0{width}d}"


def net_payout(actual, deductions):
    if actual is None:
        return None
    return (Decimal(actual) - Decimal(deductions or 0)).quantize(MONEY)


def partner_fits(partner, lead_category, product_name, state, loan_amount):
    if partner.status != "Active":
        return False
    amount = Decimal(loan_amount or 0)
    if amount > 0 and (amount < partner.amount_min or amount > partner.amount_max):
        return False
    states = partner.states or []
    state_ok = not states or "All" in states or state in states
    products = partner.products or []
    product_name_l = product_name.lower()
    category_l = lead_category.lower()
    product_ok = not products or any(
        product.lower() == product_name_l
        or product.lower() == category_l
        or product.lower() in product_name_l
        or category_l in product.lower()
        for product in products
    )
    return state_ok and product_ok


def is_doc_ready(status):
    return status in READY_DOC_STATUSES


def missing_required_docs(documents):
    missing = []
    for doc_type in DSA_REQUIRED_DOCS:
        rows = [doc for doc in documents if doc.doc_type == doc_type]
        if not rows or all(not is_doc_ready(row.status) for row in rows):
            missing.append(doc_type)
    return missing


def infer_pipeline_stage(lead):
    loan_statuses = list(lead.loan_cases.values_list("status", flat=True))
    if any(status in DISBURSEMENT_PLUS for status in loan_statuses):
        return "Disbursed"
    if any(status in {"Sanction", "Agreement", "Processing", "Query Raised", "Query Resolved"} for status in loan_statuses):
        return "Bank Verification"
    if any(status in {"Login", "Application Ready"} for status in loan_statuses):
        return "Submitted to PolicyBazaar"
    if lead.status in {"Documents Pending", "Documents Received"}:
        return "Documents Collected"
    return "Lead Inbound"


def ensure_lead_checklist(lead):
    existing = set(
        lead.documents.filter(loan_case__isnull=True, doc_type__in=DSA_CHECKLIST).values_list("doc_type", flat=True)
    )
    missing = [doc_type for doc_type in DSA_CHECKLIST if doc_type not in existing]
    if missing:
        Document.objects.bulk_create(
            [Document(lead=lead, doc_type=doc_type, status="Pending") for doc_type in missing]
        )


def stale_cutoff():
    return timezone.now() - timedelta(hours=STALE_FILE_HOURS)


def ensure_stale_reminders(actor):
    if not can(actor.role, "followups.write"):
        return 0
    leads = Lead.objects.filter(lead_scope(actor)).filter(
        stage_updated_at__lt=stale_cutoff(),
    ).exclude(pipeline_stage="Disbursed").exclude(status__in=["Not Interested", "Closed"]).distinct()
    created = 0
    for lead in leads:
        open_reminder = FollowUp.objects.filter(lead=lead, completed_at__isnull=True, notes__startswith="[48h]").exists()
        if open_reminder:
            continue
        FollowUp.objects.create(
            lead=lead,
            assignee=lead.assigned_to or actor,
            type="Call",
            due_at=timezone.now(),
            notes=f"[48h] {lead.code} has not moved in 48 hours. Call the customer or check the aggregator portal.",
        )
        created += 1
    return created


def _customer_for_lead(data):
    customer_id = data.get("customer_id")
    if customer_id:
        customer = Customer.objects.filter(pk=customer_id).first()
        if not customer:
            raise ValueError("Customer not found")
        return customer
    mobile = data["mobile"]
    existing = Customer.objects.filter(Q(mobile=mobile) | Q(alt_mobile=mobile)).first()
    if existing:
        return existing
    return Customer.objects.create(
        code=next_code("customer", "ADY-CU", 6),
        name=data["name"],
        mobile=mobile,
        alt_mobile=data.get("alt_mobile") or "",
        email=data.get("email") or "",
        occupation=data.get("occupation") or "",
        address=data.get("address") or "",
        state=data["state"],
        district=data["district"],
        city=data["city"],
        pincode=data.get("pincode") or "",
    )


def create_lead_record(actor, data):
    if not can(actor.role, "leads.write"):
        return {"ok": False, "error": "You do not have permission to create leads."}
    mobile = data["mobile"]
    if not data.get("customer_id") and not data.get("duplicate_choice"):
        existing = Customer.objects.filter(Q(mobile=mobile) | Q(alt_mobile=mobile)).prefetch_related("leads").first()
        if existing:
            return {
                "ok": False,
                "error": "This mobile already belongs to a customer. Choose how to continue.",
                "duplicate": existing,
            }
    assignee_id = data.get("assigned_to_id") or actor.id
    if not can(actor.role, "leads.assign"):
        assignee_id = actor.id
    with transaction.atomic():
        customer = _customer_for_lead(data)
        requirement = Requirement.objects.create(
            code=next_code("requirement", "ADY-RQ", 6),
            customer=customer,
            category=data["category"],
            product_name=data["product_name"],
            details=data.get("requirement_text") or "",
            budget=data.get("budget"),
            loan_required=bool(data.get("loan_required")),
            loan_amount=data.get("loan_amount"),
            status="Open",
        )
        lead = Lead.objects.create(
            code=next_code("lead", "ADY", 6),
            customer=customer,
            requirement=requirement,
            source=data["source"],
            category=data["category"],
            product_name=data["product_name"],
            requirement_text=data.get("requirement_text") or "",
            budget=data.get("budget"),
            loan_required=bool(data.get("loan_required")),
            loan_amount=data.get("loan_amount"),
            assigned_to_id=assignee_id,
            created_by=actor,
            dealer_id=data.get("dealer_id") or None,
            vendor_id=data.get("vendor_id") or None,
            priority=data.get("priority") or "WARM",
            status="New",
            pipeline_stage="Lead Inbound",
            stage_updated_at=timezone.now(),
            dealer_status="Pending",
            next_follow_up=data.get("next_follow_up"),
            remarks=data.get("remarks") or "",
            state=data["state"],
            district=data["district"],
            city=data["city"],
            pincode=data.get("pincode") or "",
        )
        Document.objects.bulk_create(
            [Document(lead=lead, doc_type=doc_type, status="Pending") for doc_type in DSA_CHECKLIST]
        )
        choice = data.get("duplicate_choice")
        write_audit(
            actor,
            "lead",
            lead.id,
            f"lead.create.{choice}" if choice else "lead.create",
            [{"field": "status", "old": None, "new": "New"}],
        )
        if assignee_id and assignee_id != actor.id:
            Notification.objects.create(
                user_id=assignee_id,
                title="New lead assigned",
                body=f"{lead.code} · {data['name']} · {data['product_name']}",
                href=f"/leads/{lead.id}/",
            )
    return {"ok": True, "id": lead.id, "code": lead.code}


def update_lead_record(actor, lead_id, data):
    if not can(actor.role, "leads.write") and not can(actor.role, "dealer.status"):
        return {"ok": False, "error": "You cannot edit leads."}
    lead = Lead.objects.filter(pk=lead_id).filter(lead_scope(actor)).distinct().first()
    if not lead:
        return {"ok": False, "error": "Lead not found."}
    changes = []

    def track(field, old, new):
        if text_value(old) != text_value(new):
            changes.append({"field": field, "old": old, "new": new})

    if "status" in data and data["status"]:
        track("status", lead.status, data["status"])
        lead.status = data["status"]
    if "priority" in data and data["priority"]:
        track("priority", lead.priority, data["priority"])
        lead.priority = data["priority"]
    if "assigned_to_id" in data and can(actor.role, "leads.assign"):
        track("assignedTo", lead.assigned_to_id, data["assigned_to_id"])
        lead.assigned_to_id = data["assigned_to_id"] or None
    if "dealer_id" in data:
        track("dealer", lead.dealer_id, data["dealer_id"])
        lead.dealer_id = data["dealer_id"] or None
    if "vendor_id" in data:
        track("vendor", lead.vendor_id, data["vendor_id"])
        lead.vendor_id = data["vendor_id"] or None
    if "next_follow_up" in data:
        lead.next_follow_up = data["next_follow_up"]
    if "remarks" in data:
        lead.remarks = data.get("remarks") or ""
    if "loan_required" in data:
        lead.loan_required = bool(data["loan_required"])
    if "loan_amount" in data:
        track("loanAmount", lead.loan_amount, data["loan_amount"])
        lead.loan_amount = data["loan_amount"]
    if "requirement_text" in data:
        lead.requirement_text = data.get("requirement_text") or ""
    if "dealer_status" in data and can(actor.role, "dealer.status"):
        track("dealerStatus", lead.dealer_status, data["dealer_status"])
        lead.dealer_status = data["dealer_status"]
    with transaction.atomic():
        lead.save()
        if changes:
            write_audit(actor, "lead", lead.id, "lead.update", changes)
        new_assignee = data.get("assigned_to_id")
        if new_assignee and any(row["field"] == "assignedTo" for row in changes):
            Notification.objects.create(
                user_id=new_assignee,
                title="Lead assigned to you",
                body=lead.code,
                href=f"/leads/{lead.id}/",
            )
    return {"ok": True}


def bulk_assign(actor, lead_ids, assignee_id):
    if not can(actor.role, "leads.assign"):
        return {"ok": False, "error": "You cannot assign leads."}
    if not assignee_id:
        return {"ok": False, "error": "Choose a person."}
    leads = list(Lead.objects.filter(pk__in=lead_ids).filter(lead_scope(actor)).distinct())
    for lead in leads:
        update_lead_record(actor, lead.id, {"assigned_to_id": assignee_id})
    return {"ok": True, "count": len(leads)}


def move_pipeline_stage(actor, lead_id, pipeline_stage):
    if not can(actor.role, "leads.write"):
        return {"ok": False, "error": "You cannot move files."}
    if pipeline_stage not in DSA_PIPELINE:
        return {"ok": False, "error": "Unknown pipeline stage."}
    lead = (
        Lead.objects.filter(pk=lead_id)
        .filter(lead_scope(actor))
        .prefetch_related("documents")
        .distinct()
        .first()
    )
    if not lead:
        return {"ok": False, "error": "Lead not found."}
    if lead.pipeline_stage == pipeline_stage:
        return {"ok": True}
    next_index = DSA_PIPELINE.index(pipeline_stage)
    aggregator_index = DSA_PIPELINE.index("Submitted to PolicyBazaar")
    checklist = [doc for doc in lead.documents.all() if doc.loan_case_id is None]
    if next_index >= aggregator_index:
        missing = missing_required_docs(checklist)
        if missing:
            return {"ok": False, "error": f"Still missing before the aggregator: {', '.join(missing)}."}
    previous_stage = lead.pipeline_stage
    current_index = DSA_PIPELINE.index(previous_stage) if previous_stage in DSA_PIPELINE else -1
    lead.pipeline_stage = pipeline_stage
    lead.stage_updated_at = timezone.now()
    if next_index > current_index and pipeline_stage in STATUS_FOR_STAGE:
        lead.status = STATUS_FOR_STAGE[pipeline_stage]
    with transaction.atomic():
        lead.save(update_fields=["pipeline_stage", "stage_updated_at", "status", "updated_at"])
        write_audit(
            actor,
            "lead",
            lead.id,
            "lead.pipeline",
            [{"field": "pipelineStage", "old": previous_stage, "new": pipeline_stage}],
        )
    return {"ok": True}


def log_interaction(actor, lead_id, kind, result, notes):
    if not can(actor.role, "followups.write"):
        return {"ok": False, "error": "You cannot log this."}
    lead = Lead.objects.filter(pk=lead_id).filter(lead_scope(actor)).distinct().first()
    if not lead:
        return {"ok": False, "error": "Lead not found."}
    FollowUp.objects.create(
        lead=lead,
        assignee=actor,
        type="WhatsApp" if kind == "WhatsApp" else kind if kind in {"Call", "WhatsApp"} else "Call",
        due_at=timezone.now(),
        completed_at=timezone.now(),
        result=result,
        notes=notes or ("WhatsApp template sent" if kind == "WhatsApp" else "Call logged from the pipeline"),
    )
    return {"ok": True, "lead": lead}


def create_loan_case(actor, data):
    if not can(actor.role, "loans.create"):
        return {"ok": False, "error": "You cannot open a finance case."}
    lead = Lead.objects.filter(pk=data["lead_id"]).filter(lead_scope(actor)).select_related("customer").distinct().first()
    if not lead:
        return {"ok": False, "error": "Lead not found."}
    amount = data["loan_amount"]
    if not lead.loan_required and amount <= 0:
        return {"ok": False, "error": "Enter a loan amount before opening a finance case."}
    lender = None
    if data.get("lender_id"):
        lender = FinancePartner.objects.filter(pk=data["lender_id"]).first()
        if not lender:
            return {"ok": False, "error": "Finance partner not found."}
        if not partner_fits(lender, lead.category, lead.product_name, lead.state, amount):
            return {"ok": False, "error": "That partner is outside the configured product, location, or amount range."}
    with transaction.atomic():
        loan = LoanCase.objects.create(
            code=next_code("loan", "ADY-LN", 5),
            lead=lead,
            customer=lead.customer,
            requirement=lead.requirement,
            product_name=lead.product_name,
            loan_type=data["loan_type"],
            loan_amount=amount,
            lender=lender,
            dealer=lead.dealer,
            executive_id=data.get("executive_id") or None,
            status="New",
            remarks=data.get("remarks") or "",
        )
        Document.objects.bulk_create(
            [Document(loan_case=loan, lead=lead, doc_type=doc_type, status="Pending") for doc_type in DOCUMENT_TYPES]
        )
        StatusEvent.objects.create(loan_case=loan, from_status="", to_status="New", user=actor, note="Case opened")
        write_audit(actor, "loan", loan.id, "loan.create", [{"field": "status", "old": None, "new": "New"}])
    return {"ok": True, "id": loan.id, "code": loan.code}


def update_loan_case(actor, loan_id, data):
    if not can(actor.role, "loans.update"):
        return {"ok": False, "error": "You cannot update finance cases."}
    loan = LoanCase.objects.filter(pk=loan_id).filter(loan_scope(actor)).distinct().first()
    if not loan:
        return {"ok": False, "error": "Loan case not found."}
    status = data["status"]
    now = timezone.now()
    sanction_date = data["sanction_date"] if "sanction_date" in data else loan.sanction_date
    if sanction_date is None and status == "Sanction":
        sanction_date = now
    disbursement_date = data["disbursement_date"] if "disbursement_date" in data else loan.disbursement_date
    if disbursement_date is None and status in {"Disbursement", "Payout Pending", "Payout Received", "Closed"}:
        disbursement_date = now
    login_date = data["login_date"] if "login_date" in data else loan.login_date
    if login_date is None and status == "Login":
        login_date = now
    previous = loan.status
    loan.status = status
    if data.get("note"):
        loan.remarks = data["note"]
    if "application_number" in data:
        loan.application_number = data.get("application_number") or ""
    if "executive_id" in data:
        loan.executive_id = data.get("executive_id") or None
    if "lender_id" in data:
        loan.lender_id = data.get("lender_id") or None
    if "sanction_amount" in data:
        loan.sanction_amount = data["sanction_amount"]
    if "disbursement_amount" in data:
        loan.disbursement_amount = data["disbursement_amount"]
    if "query_note" in data:
        loan.query_note = data.get("query_note") or ""
    loan.sanction_date = sanction_date
    loan.disbursement_date = disbursement_date
    loan.login_date = login_date
    with transaction.atomic():
        loan.save()
        if previous != status:
            StatusEvent.objects.create(
                loan_case=loan,
                from_status=previous,
                to_status=status,
                note=data.get("note") or "",
                user=actor,
            )
            write_audit(
                actor,
                "loan",
                loan.id,
                "loan.status",
                [{"field": "status", "old": previous, "new": status}],
            )
    return {"ok": True}


def save_payout(actor, data):
    if not can(actor.role, "payouts.write"):
        return {"ok": False, "error": "You cannot record payouts."}
    loan = LoanCase.objects.filter(pk=data["loan_case_id"]).filter(loan_scope(actor)).distinct().first()
    if not loan:
        return {"ok": False, "error": "Loan case not found."}
    if data.get("expected_payout") is None and data.get("actual_payout") is None:
        return {"ok": False, "error": "Enter an expected or received amount. Payout rates are not hard-coded."}
    payout = None
    if data.get("id"):
        payout = Payout.objects.filter(pk=data["id"], loan_case=loan).first()
        if not payout:
            return {"ok": False, "error": "Payout not found on this case."}
    net = net_payout(data.get("actual_payout"), data.get("deductions") or 0)
    with transaction.atomic():
        if payout is None:
            payout = Payout(loan_case=loan)
        payout.partner_kind = data["partner_kind"]
        payout.partner_name = data["partner_name"]
        payout.transaction_amount = data.get("transaction_amount")
        payout.expected_payout = data.get("expected_payout")
        payout.actual_payout = data.get("actual_payout")
        payout.invoice_no = data.get("invoice_no") or ""
        payout.deductions = data.get("deductions") or 0
        payout.net_received = net
        payout.payout_date = data.get("payout_date")
        payout.status = data["status"]
        payout.notes = data.get("notes") or ""
        payout.save()
        write_audit(
            actor,
            "payout",
            payout.id,
            "payout.update" if data.get("id") else "payout.create",
            [
                {"field": "expectedPayout", "new": data.get("expected_payout")},
                {"field": "actualPayout", "new": data.get("actual_payout")},
                {"field": "netReceived", "new": net},
                {"field": "status", "new": data["status"]},
            ],
        )
    return {"ok": True, "id": payout.id, "net": net}


def _storage_root():
    root = Path(settings.BASE_DIR) / "storage"
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def store_upload(folder, upload):
    if upload.size > 8 * 1024 * 1024:
        raise ValueError("File must be 8 MB or smaller.")
    mime = upload.content_type or ""
    if mime not in ALLOWED_MIME:
        raise ValueError("Upload a PDF or a photo.")
    name = Path(upload.name or "file").name
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:80] or "file"
    if ".." in folder or folder.startswith("/"):
        raise ValueError("Invalid storage key")
    key = f"{folder}/{uuid.uuid4().hex}-{name}"
    root = _storage_root()
    destination = (root / key).resolve()
    if root not in destination.parents:
        raise ValueError("Invalid storage key")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        for chunk in upload.chunks():
            handle.write(chunk)
    return key, name, mime, upload.size


def stored_file_path(key):
    if not key or ".." in key or key.startswith("/"):
        raise ValueError("Invalid storage key")
    root = _storage_root()
    full = (root / key).resolve()
    if root not in full.parents and full != root:
        raise ValueError("Invalid storage key")
    return full


def save_checklist_document(actor, lead_id, doc_type, status, upload=None, notes=""):
    if not can(actor.role, "documents.write"):
        return {"ok": False, "error": "You cannot update documents."}
    lead = Lead.objects.filter(pk=lead_id).filter(lead_scope(actor)).distinct().first()
    if not lead:
        return {"ok": False, "error": "Lead not found."}
    if doc_type not in DSA_CHECKLIST:
        return {"ok": False, "error": "Unknown document."}
    document = Document.objects.filter(lead=lead, loan_case__isnull=True, doc_type=doc_type).first()
    if document is None:
        document = Document(lead=lead, doc_type=doc_type, status="Pending")
    document.status = status or document.status
    document.notes = notes or document.notes
    document.uploaded_by = actor
    if upload:
        key, name, mime, size = store_upload(f"leads/{lead.id}", upload)
        document.storage_key = key
        document.file_name = name
        document.mime_type = mime
        document.size_bytes = size
        document.version = (document.version or 1) + (1 if document.pk else 0)
        if document.status == "Pending":
            document.status = "Uploaded"
    document.save()
    return {"ok": True}


def save_loan_document(actor, loan_id, doc_type, status, upload=None, notes=""):
    if not can(actor.role, "documents.write"):
        return {"ok": False, "error": "You cannot update documents."}
    loan = LoanCase.objects.filter(pk=loan_id).filter(loan_scope(actor)).distinct().first()
    if not loan:
        return {"ok": False, "error": "Loan case not found."}
    document = Document.objects.filter(loan_case=loan, doc_type=doc_type).first()
    if document is None:
        document = Document(loan_case=loan, lead=loan.lead, doc_type=doc_type, status="Pending")
    document.status = status or document.status
    document.notes = notes or document.notes
    document.uploaded_by = actor
    if upload:
        key, name, mime, size = store_upload(f"loans/{loan.id}", upload)
        document.storage_key = key
        document.file_name = name
        document.mime_type = mime
        document.size_bytes = size
        document.version = (document.version or 1) + (1 if document.pk else 0)
        if document.status == "Pending":
            document.status = "Uploaded"
    document.save()
    return {"ok": True}


def create_followup(actor, data):
    if not can(actor.role, "followups.write"):
        return {"ok": False, "error": "You cannot add follow-ups."}
    lead = None
    loan = None
    if data.get("lead_id"):
        lead = Lead.objects.filter(pk=data["lead_id"]).filter(lead_scope(actor)).distinct().first()
        if not lead:
            return {"ok": False, "error": "Lead not found."}
    if data.get("loan_case_id"):
        loan = LoanCase.objects.filter(pk=data["loan_case_id"]).filter(loan_scope(actor)).distinct().first()
        if not loan:
            return {"ok": False, "error": "Loan case not found."}
    FollowUp.objects.create(
        lead=lead,
        loan_case=loan,
        assignee=actor,
        type=data["type"],
        due_at=data["due_at"],
        notes=data.get("notes") or "",
    )
    if lead and data.get("due_at"):
        lead.next_follow_up = data["due_at"]
        lead.save(update_fields=["next_follow_up", "updated_at"])
    return {"ok": True}


def complete_followup(actor, followup_id, result, notes):
    if not can(actor.role, "followups.write"):
        return {"ok": False, "error": "You cannot close follow-ups."}
    item = FollowUp.objects.filter(pk=followup_id).filter(followup_scope(actor)).distinct().first()
    if not item:
        return {"ok": False, "error": "Follow-up not found."}
    item.completed_at = timezone.now()
    item.result = result or item.result
    if notes:
        item.notes = notes
    item.save(update_fields=["completed_at", "result", "notes"])
    return {"ok": True}
