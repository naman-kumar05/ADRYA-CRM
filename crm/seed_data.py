from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .constants import DEMO_PASSWORD, LEAD_SOURCES, LEAD_STATUSES, LOAN_STATUSES, PRODUCTS
from .models import (
    Campaign,
    Dealer,
    Document,
    FinancePartner,
    FollowUp,
    Lead,
    LeadSource,
    Product,
    StatusOption,
    Territory,
    User,
    Vendor,
)
from .services import (
    create_lead_record,
    create_loan_case,
    infer_pipeline_stage,
    next_code,
    save_payout,
    update_lead_record,
    update_loan_case,
)


def days_from_now(days, hour=10):
    base = timezone.localtime().replace(hour=hour, minute=0, second=0, microsecond=0)
    return base + timedelta(days=days)


def seed_database():
    places = [
        ("Uttar Pradesh", "Meerut", "Meerut"),
        ("Uttar Pradesh", "Hapur", "Hapur"),
        ("Uttar Pradesh", "Bulandshahr", "Bulandshahr"),
        ("Uttar Pradesh", "Ghaziabad", "Ghaziabad"),
        ("Uttar Pradesh", "Muzaffarnagar", "Muzaffarnagar"),
        ("Uttar Pradesh", "Gautam Buddha Nagar", "Greater Noida West"),
        ("Rajasthan", "Jaipur", "Jaipur"),
        ("Rajasthan", "Alwar", "Alwar"),
        ("Rajasthan", "Bharatpur", "Bharatpur"),
        ("Maharashtra", "Pune", "Pune"),
        ("Maharashtra", "Nashik", "Nashik"),
        ("Madhya Pradesh", "Bhopal", "Bhopal"),
        ("Madhya Pradesh", "Indore", "Indore"),
        ("Bihar", "Patna", "Patna"),
        ("Haryana", "Karnal", "Karnal"),
        ("Haryana", "Hisar", "Hisar"),
    ]
    Territory.objects.bulk_create([Territory(state=s, district=d, city=c) for s, d, c in places])
    Product.objects.bulk_create([Product(category=category, name=name) for category, name in PRODUCTS])
    LeadSource.objects.bulk_create([LeadSource(name=name) for name in LEAD_SOURCES])
    StatusOption.objects.bulk_create(
        [StatusOption(entity="lead", name=name, sort=index) for index, name in enumerate(LEAD_STATUSES)]
        + [StatusOption(entity="loan", name=name, sort=index) for index, name in enumerate(LOAN_STATUSES)]
    )
    Campaign.objects.bulk_create(
        [
            Campaign(name="Google search — tractor", source="Google", spend=Decimal("25000")),
            Campaign(name="Facebook lead ads", source="Facebook", spend=Decimal("15000")),
            Campaign(name="Dealer counter", source="Dealer", spend=0),
        ]
    )

    with transaction.atomic():
        dealer = Dealer.objects.create(
            code=next_code("dealer", "ADY-DL", 4),
            company_name="ABC Tractors",
            brands=["Mahindra", "Sonalika"],
            contact_name="Rakesh Gupta",
            mobile="9811200001",
            email="rakesh@abctractors.test",
            state="Uttar Pradesh",
            district="Meerut",
            city="Meerut",
            territory="Meerut, Hapur, Bulandshahr",
            products=["Tractor", "Used Tractor"],
            agreement_status="Active",
            payout_terms="As per dealer agreement. Enter the case amount; do not assume a percentage.",
            status="Active",
        )
    with transaction.atomic():
        vendor = Vendor.objects.create(
            code=next_code("vendor", "ADY-VN", 4),
            company_name="Surya Solar",
            contact_name="Neha Verma",
            mobile="9811200002",
            email="neha@surya.test",
            service_area="Western UP",
            products=["Residential Solar", "Solar Pump"],
            capacity="Up to 10 kW residential",
            install_capability="Rooftop and pump sets",
            pricing_reference="Current rate card on file",
            agreement_status="Active",
            payout_terms="Per installation contract",
            status="Active",
            state="Uttar Pradesh",
            district="Meerut",
            city="Meerut",
        )

    partner_input = [
        {
            "name": "Mahindra Finance",
            "partner_type": "NBFC",
            "products": ["Tractor", "Used Tractor", "Agriculture"],
            "states": ["Uttar Pradesh"],
            "loan_types": ["New", "Used"],
            "amount_min": Decimal("50000"),
            "amount_max": Decimal("2000000"),
            "rm_name": "Amitabh Rao",
            "document_checklist": "KYC, income, quotation, asset documents",
            "payout_terms": "Per executed payout grid for this partner",
        },
        {
            "name": "SBI Agri",
            "partner_type": "Bank",
            "products": ["Agriculture", "Tractor", "Harvester", "Solar Pump"],
            "states": ["All"],
            "loan_types": ["New"],
            "amount_min": Decimal("50000"),
            "amount_max": Decimal("5000000"),
            "rm_name": "Branch RM",
            "document_checklist": "KYC, land records, quotation",
            "payout_terms": "Bank schedule, case by case",
        },
        {
            "name": "HDFC Home Loans",
            "partner_type": "Bank",
            "products": ["Home Loan"],
            "states": ["All"],
            "loan_types": ["New"],
            "amount_min": Decimal("200000"),
            "amount_max": Decimal("10000000"),
            "rm_name": "Home RM",
            "document_checklist": "KYC, income, property papers",
            "payout_terms": "Home loan agreement",
        },
        {
            "name": "Tata Capital Auto",
            "partner_type": "NBFC",
            "products": ["Auto Loan", "Used Vehicle Loan"],
            "states": ["All"],
            "loan_types": ["New", "Used"],
            "amount_min": Decimal("50000"),
            "amount_max": Decimal("3000000"),
            "rm_name": "Auto RM",
            "document_checklist": "KYC, bank statement, quotation",
            "payout_terms": "Auto payout grid on the agreement",
        },
    ]
    partners = []
    for item in partner_input:
        with transaction.atomic():
            partners.append(FinancePartner.objects.create(code=next_code("partner", "ADY-FP", 4), status="Active", **item))

    people = [
        ("Adrya Admin", "admin@adrya.test", "SUPER_ADMIN"),
        ("Operations Admin", "ops@adrya.test", "ADMIN"),
        ("Sales Manager", "manager@adrya.test", "SALES_MANAGER"),
        ("Amit Sharma", "amit@adrya.test", "SALES_EXECUTIVE"),
        ("Finance Manager", "finance.manager@adrya.test", "FINANCE_MANAGER"),
        ("Finance Executive", "finance@adrya.test", "FINANCE_EXECUTIVE"),
        ("Accounts Desk", "accounts@adrya.test", "ACCOUNTS"),
        ("Management", "management@adrya.test", "MANAGEMENT"),
        ("ABC Tractors", "dealer@abctractors.test", "DEALER"),
        ("Surya Solar", "vendor@surya.test", "VENDOR"),
    ]
    users = {}
    for name, email, role in people:
        user = User(
            name=name,
            email=email,
            role=role,
            monthly_lead_target=20 if email == "amit@adrya.test" else None,
            dealer=dealer if role == "DEALER" else None,
            vendor=vendor if role == "VENDOR" else None,
        )
        user.set_password(DEMO_PASSWORD)
        user.save()
        users[email] = user

    admin = users["ops@adrya.test"]
    amit = users["amit@adrya.test"]
    finance = users["finance@adrya.test"]
    accounts = users["accounts@adrya.test"]
    manager = users["manager@adrya.test"]
    finance_manager = users["finance.manager@adrya.test"]

    samples = [
        {"name": "Ramesh Kumar", "mobile": "9811100001", "source": "Google", "category": "Agriculture", "product_name": "Tractor", "state": "Uttar Pradesh", "district": "Meerut", "city": "Meerut", "loan_required": True, "loan_amount": Decimal("600000"), "budget": Decimal("750000"), "priority": "HOT", "assigned_to_id": amit.id, "dealer_id": dealer.id, "requirement_text": "New tractor for wheat season. Looking at 45 HP.", "status": "Interested", "created_days_ago": 12},
        {"name": "Suresh Yadav", "mobile": "9811100002", "source": "Dealer", "category": "Agriculture", "product_name": "Used Tractor", "state": "Uttar Pradesh", "district": "Hapur", "city": "Hapur", "loan_required": True, "loan_amount": Decimal("450000"), "budget": Decimal("480000"), "priority": "WARM", "assigned_to_id": amit.id, "dealer_id": dealer.id, "requirement_text": "Used tractor, budget under 5 lakh.", "status": "Contacted", "created_days_ago": 6},
        {"name": "Mohan Lal", "mobile": "9811100003", "source": "Website", "category": "Solar", "product_name": "Solar Pump", "state": "Uttar Pradesh", "district": "Bulandshahr", "city": "Bulandshahr", "loan_required": True, "loan_amount": Decimal("180000"), "budget": Decimal("210000"), "priority": "WARM", "assigned_to_id": amit.id, "vendor_id": vendor.id, "requirement_text": "5 HP solar pump for irrigation.", "status": "Documents Pending", "created_days_ago": 4},
        {"name": "Imran Khan", "mobile": "9811100004", "source": "Facebook", "category": "Finance", "product_name": "Auto Loan", "state": "Uttar Pradesh", "district": "Ghaziabad", "city": "Ghaziabad", "loan_required": True, "loan_amount": Decimal("500000"), "budget": Decimal("500000"), "priority": "HOT", "assigned_to_id": amit.id, "requirement_text": "Commercial vehicle loan.", "status": "Interested", "created_days_ago": 20},
        {"name": "Kavita Singh", "mobile": "9811100005", "source": "Referral", "category": "Finance", "product_name": "Home Loan", "state": "Rajasthan", "district": "Jaipur", "city": "Jaipur", "loan_required": True, "loan_amount": Decimal("2500000"), "budget": Decimal("2500000"), "priority": "WARM", "assigned_to_id": amit.id, "requirement_text": "Home purchase in Jaipur.", "status": "Documents Pending", "created_days_ago": 8},
        {"name": "Sunita Devi", "mobile": "9811100006", "source": "Instagram", "category": "Solar", "product_name": "Residential Solar", "state": "Maharashtra", "district": "Nashik", "city": "Nashik", "loan_required": False, "loan_amount": None, "budget": Decimal("220000"), "priority": "WARM", "assigned_to_id": amit.id, "vendor_id": vendor.id, "requirement_text": "3 kW rooftop. No loan.", "status": "New", "created_days_ago": 2},
        {"name": "Harish Patel", "mobile": "9811100007", "source": "Call", "category": "Insurance", "product_name": "Motor Insurance", "state": "Haryana", "district": "Karnal", "city": "Karnal", "loan_required": False, "loan_amount": None, "budget": Decimal("12000"), "priority": "COLD", "assigned_to_id": amit.id, "requirement_text": "Tractor insurance renewal.", "status": "Interested", "created_days_ago": 3},
        {"name": "Deepak Sharma", "mobile": "9811100008", "source": "Walk-in", "category": "Agriculture", "product_name": "Harvester", "state": "Rajasthan", "district": "Alwar", "city": "Alwar", "loan_required": True, "loan_amount": Decimal("900000"), "budget": Decimal("1400000"), "priority": "COLD", "assigned_to_id": amit.id, "requirement_text": "Asked for a price, then declined.", "status": "Not Interested", "created_days_ago": 15},
        {"name": "Pooja Kumari", "mobile": "9811100009", "source": "WhatsApp", "category": "Agriculture", "product_name": "Tractor", "state": "Uttar Pradesh", "district": "Meerut", "city": "Meerut", "loan_required": True, "loan_amount": Decimal("550000"), "budget": Decimal("700000"), "priority": "HOT", "assigned_to_id": amit.id, "dealer_id": dealer.id, "requirement_text": "Called this morning.", "status": "New", "created_days_ago": 0},
        {"name": "Nitin Rao", "mobile": "9811100010", "source": "Website", "category": "Agriculture", "product_name": "Cultivator", "state": "Bihar", "district": "Patna", "city": "Patna", "loan_required": False, "loan_amount": None, "budget": Decimal("80000"), "priority": "WARM", "assigned_to_id": manager.id, "requirement_text": "Website form, cultivator quote.", "status": "New", "created_days_ago": 0},
    ]

    lead_ids = {}
    for sample in samples:
        created = create_lead_record(
            admin,
            {
                "name": sample["name"],
                "mobile": sample["mobile"],
                "state": sample["state"],
                "district": sample["district"],
                "city": sample["city"],
                "source": sample["source"],
                "category": sample["category"],
                "product_name": sample["product_name"],
                "loan_required": sample["loan_required"],
                "loan_amount": sample["loan_amount"],
                "budget": sample["budget"],
                "priority": sample["priority"],
                "assigned_to_id": sample["assigned_to_id"],
                "dealer_id": sample.get("dealer_id"),
                "vendor_id": sample.get("vendor_id"),
                "requirement_text": sample["requirement_text"],
            },
        )
        if not created["ok"]:
            raise RuntimeError(created["error"])
        lead_ids[sample["mobile"]] = created["id"]
        updated = update_lead_record(admin, created["id"], {"status": sample["status"]})
        if not updated["ok"]:
            raise RuntimeError(updated["error"])
        if sample["created_days_ago"]:
            Lead.objects.filter(pk=created["id"]).update(created_at=days_from_now(-sample["created_days_ago"], 9))

    def open_case(**kwargs):
        result = create_loan_case(admin, kwargs)
        if not result["ok"]:
            raise RuntimeError(result["error"])
        return result

    ramesh = open_case(lead_id=lead_ids["9811100001"], lender_id=partners[0].id, executive_id=finance.id, loan_type="New", loan_amount=Decimal("600000"), remarks="Customer comparing two dealers.")
    moved = update_loan_case(finance_manager, ramesh["id"], {"status": "Processing", "note": "File logged with the lender", "application_number": "MF-UP-2291", "login_date": days_from_now(-3)})
    if not moved["ok"]:
        raise RuntimeError(moved["error"])
    Document.objects.filter(loan_case_id=ramesh["id"], doc_type__in=["KYC", "PAN", "Address proof", "Quotation"]).update(status="Verified")
    Document.objects.filter(loan_case_id=ramesh["id"], doc_type="Bank statement").update(status="Uploaded")

    imran = open_case(lead_id=lead_ids["9811100004"], lender_id=partners[3].id, executive_id=finance.id, loan_type="New", loan_amount=Decimal("500000"))
    moved = update_loan_case(
        finance_manager,
        imran["id"],
        {
            "status": "Disbursement",
            "note": "Lender confirmed disbursement",
            "application_number": "TC-44120",
            "sanction_amount": Decimal("480000"),
            "sanction_date": days_from_now(-10),
            "disbursement_amount": Decimal("480000"),
            "disbursement_date": days_from_now(-4),
            "login_date": days_from_now(-18),
        },
    )
    if not moved["ok"]:
        raise RuntimeError(moved["error"])

    kavita = open_case(lead_id=lead_ids["9811100005"], lender_id=partners[2].id, executive_id=finance.id, loan_type="New", loan_amount=Decimal("2500000"))
    moved = update_loan_case(finance_manager, kavita["id"], {"status": "Documents Pending", "note": "Income proof still open"})
    if not moved["ok"]:
        raise RuntimeError(moved["error"])

    payout = save_payout(
        accounts,
        {
            "loan_case_id": imran["id"],
            "partner_kind": "Lender",
            "partner_name": "Tata Capital Auto",
            "transaction_amount": Decimal("480000"),
            "expected_payout": Decimal("18000"),
            "actual_payout": Decimal("15000"),
            "deductions": Decimal("500"),
            "invoice_no": "INV-2401",
            "payout_date": days_from_now(-2),
            "status": "Received",
            "notes": "Short payout against the contract grid. Net is actual minus deductions.",
        },
    )
    if not payout["ok"]:
        raise RuntimeError(payout["error"])
    payout = save_payout(
        accounts,
        {
            "loan_case_id": ramesh["id"],
            "partner_kind": "Lender",
            "partner_name": "Mahindra Finance",
            "transaction_amount": Decimal("600000"),
            "expected_payout": Decimal("12000"),
            "actual_payout": None,
            "deductions": 0,
            "status": "Expected",
            "notes": "Expected only. Not received.",
        },
    )
    if not payout["ok"]:
        raise RuntimeError(payout["error"])

    FollowUp.objects.bulk_create(
        [
            FollowUp(lead_id=lead_ids["9811100001"], assignee=amit, type="Call", due_at=days_from_now(1, 11), notes="Confirm dealer visit"),
            FollowUp(lead_id=lead_ids["9811100002"], assignee=amit, type="Dealer Follow-up", due_at=days_from_now(-1, 16), notes="Dealer has not accepted yet"),
            FollowUp(lead_id=lead_ids["9811100005"], loan_case_id=kavita["id"], assignee=finance, type="Document Follow-up", due_at=days_from_now(0, 15), notes="Ask for income proof"),
            FollowUp(lead_id=lead_ids["9811100004"], loan_case_id=imran["id"], assignee=amit, type="Call", due_at=days_from_now(-6, 12), completed_at=days_from_now(-6, 12), result="Converted", notes="Customer confirmed disbursement"),
        ]
    )
    Lead.objects.filter(pk=lead_ids["9811100001"]).update(dealer_status="Accepted", next_follow_up=days_from_now(1, 11))
    Lead.objects.filter(pk=lead_ids["9811100002"]).update(dealer_status="Pending", next_follow_up=days_from_now(-1, 16))

    for lead in Lead.objects.all():
        Lead.objects.filter(pk=lead.pk).update(pipeline_stage=infer_pipeline_stage(lead), stage_updated_at=lead.created_at)
