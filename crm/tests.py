import json
from decimal import Decimal

from django.test import TestCase, override_settings

from crm.constants import DEMO_PASSWORD
from crm.models import Document, FinancePartner, Lead, Payout, User
from crm.seed_data import seed_database
from crm.services import create_lead_record, create_loan_case, move_pipeline_stage, net_payout


@override_settings(INTAKE_API_KEY="test-intake-key")
class CrmRulesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_database()

    def test_net_payout_is_actual_minus_deductions(self):
        self.assertEqual(net_payout(Decimal("15000"), Decimal("500")), Decimal("14500.00"))
        payout = Payout.objects.get(invoice_no="INV-2401")
        self.assertEqual(payout.net_received, Decimal("14500.00"))
        self.assertEqual(payout.status, "Received")

    def test_sales_executive_sees_only_assigned_leads(self):
        amit = User.objects.get(email="amit@adrya.test")
        admin = User.objects.get(email="ops@adrya.test")
        self.client.force_login(amit)
        own = self.client.get("/leads/")
        self.assertNotContains(own, "Nitin Rao")
        self.assertContains(own, "Ramesh Kumar")
        self.client.force_login(admin)
        everyone = self.client.get("/leads/")
        self.assertContains(everyone, "Nitin Rao")
        self.assertGreater(everyone.content.count(b"ADY-"), own.content.count(b"ADY-"))

    def test_dealer_and_vendor_scopes(self):
        dealer = User.objects.get(email="dealer@abctractors.test")
        self.client.force_login(dealer)
        page = self.client.get("/leads/")
        self.assertContains(page, "Ramesh Kumar")
        self.assertNotContains(page, "Imran Khan")
        self.assertContains(self.client.get("/settings/"), "Outside your role", status_code=403)
        vendor = User.objects.get(email="vendor@surya.test")
        self.client.force_login(vendor)
        page = self.client.get("/leads/")
        self.assertContains(page, "Mohan Lal")
        self.assertNotContains(page, "Imran Khan")

    def test_finance_executive_sees_assigned_cases(self):
        finance = User.objects.get(email="finance@adrya.test")
        self.client.force_login(finance)
        page = self.client.get("/loans/")
        self.assertContains(page, "Ramesh Kumar")
        self.assertContains(page, "final decision")
        self.assertNotContains(page, "Sunita Devi")

    def test_management_cannot_create_a_lead(self):
        management = User.objects.get(email="management@adrya.test")
        self.client.force_login(management)
        self.assertEqual(self.client.get("/leads/new/").status_code, 403)
        self.assertNotContains(self.client.get("/leads/"), "New lead")

    def test_duplicate_mobile_needs_a_choice_then_reuses_the_customer(self):
        admin = User.objects.get(email="ops@adrya.test")
        first = create_lead_record(
            admin,
            {
                "name": "New Person",
                "mobile": "9811199999",
                "state": "Uttar Pradesh",
                "district": "Meerut",
                "city": "Meerut",
                "source": "Call",
                "category": "Agriculture",
                "product_name": "Tractor",
                "loan_required": False,
                "loan_amount": None,
                "budget": None,
                "priority": "WARM",
            },
        )
        self.assertTrue(first["ok"])
        second = create_lead_record(
            admin,
            {
                "name": "New Person",
                "mobile": "9811199999",
                "state": "Uttar Pradesh",
                "district": "Meerut",
                "city": "Meerut",
                "source": "Call",
                "category": "Agriculture",
                "product_name": "Cultivator",
                "loan_required": False,
                "loan_amount": None,
                "budget": None,
                "priority": "WARM",
            },
        )
        self.assertFalse(second["ok"])
        self.assertIn("duplicate", second)
        third = create_lead_record(
            admin,
            {
                "name": "New Person",
                "mobile": "9811199999",
                "state": "Uttar Pradesh",
                "district": "Meerut",
                "city": "Meerut",
                "source": "Call",
                "category": "Agriculture",
                "product_name": "Cultivator",
                "loan_required": False,
                "loan_amount": None,
                "budget": None,
                "priority": "WARM",
                "duplicate_choice": "requirement",
            },
        )
        self.assertTrue(third["ok"])
        self.assertEqual(Lead.objects.filter(customer__mobile="9811199999").count(), 2)

    def test_aggregator_stage_waits_for_pan_aadhaar_and_bank_statement(self):
        admin = User.objects.get(email="ops@adrya.test")
        created = create_lead_record(
            admin,
            {
                "name": "Gate Check",
                "mobile": "9811188888",
                "state": "Uttar Pradesh",
                "district": "Meerut",
                "city": "Meerut",
                "source": "Call",
                "category": "Agriculture",
                "product_name": "Tractor",
                "loan_required": True,
                "loan_amount": Decimal("100000"),
                "budget": None,
                "priority": "HOT",
            },
        )
        blocked = move_pipeline_stage(admin, created["id"], "Submitted to PolicyBazaar")
        self.assertFalse(blocked["ok"])
        self.assertIn("PAN", blocked["error"])
        Document.objects.filter(lead_id=created["id"], loan_case__isnull=True, doc_type__in=["PAN", "Aadhaar", "Bank statement"]).update(status="Uploaded")
        opened = move_pipeline_stage(admin, created["id"], "Submitted to PolicyBazaar")
        self.assertTrue(opened["ok"])
        self.assertEqual(Lead.objects.get(pk=created["id"]).status, "Interested")

    def test_wrong_lender_is_rejected(self):
        admin = User.objects.get(email="ops@adrya.test")
        lead = Lead.objects.get(customer__mobile="9811100005")
        mahindra = create_loan_case(
            admin,
            {
                "lead_id": lead.id,
                "lender_id": FinancePartner.objects.get(name="Mahindra Finance").id,
                "loan_type": "New",
                "loan_amount": Decimal("2500000"),
            },
        )
        self.assertFalse(mahindra["ok"])

    def test_intake_requires_the_server_key_and_creates_a_lead(self):
        denied = self.client.post("/api/intake/", data="{}", content_type="application/json")
        self.assertEqual(denied.status_code, 401)
        payload = {
            "name": "Website Visitor",
            "mobile": "9811177777",
            "category": "Finance",
            "productName": "Personal Loan",
            "state": "Uttar Pradesh",
            "district": "Gautam Buddha Nagar",
            "city": "Greater Noida West",
            "loanRequired": True,
            "loanAmount": 200000,
        }
        allowed = self.client.post(
            "/api/intake/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_API_KEY="test-intake-key",
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(allowed.json()["leadId"].startswith("ADY-"))
        self.assertTrue(Lead.objects.filter(customer__mobile="9811177777", source="Website").exists())

    def test_login_and_main_screens(self):
        self.assertEqual(self.client.get("/login/").status_code, 200)
        admin = User.objects.get(email="admin@adrya.test")
        self.assertTrue(admin.check_password(DEMO_PASSWORD))
        self.client.force_login(admin)
        for path in ("/dashboard/", "/pipeline/", "/leads/", "/follow-ups/", "/loans/", "/payouts/", "/reports/"):
            self.assertEqual(self.client.get(path).status_code, 200, path)
        pipeline = self.client.get("/pipeline/")
        self.assertContains(pipeline, "Search name or mobile")
        self.assertContains(pipeline, "Submitted to PolicyBazaar")
        self.assertContains(pipeline, "Call")
