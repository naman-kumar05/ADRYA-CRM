import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .constants import PRIORITIES, ROLES


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("An email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "SUPER_ADMIN")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("name", "Super admin")
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    mobile = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=32, choices=[(role, role) for role in ROLES])
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    monthly_lead_target = models.PositiveIntegerField(null=True, blank=True)
    dealer = models.ForeignKey("Dealer", null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    vendor = models.ForeignKey("Vendor", null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        indexes = [models.Index(fields=["role"]), models.Index(fields=["is_active"])]

    def __str__(self):
        return self.name


class LoginHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="login_history")
    email = models.EmailField()
    success = models.BooleanField()
    ip = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["email"]), models.Index(fields=["created_at"])]


class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=160)
    mobile = models.CharField(max_length=15, unique=True)
    alt_mobile = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    state = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    pincode = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["name"]), models.Index(fields=["created_at"])]

    def __str__(self):
        return f"{self.name} · {self.mobile}"


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=40)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["category", "name"], name="uniq_product")]
        ordering = ["category", "name"]


class LeadSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80, unique=True)
    active = models.BooleanField(default=True)


class StatusOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.CharField(max_length=20)
    name = models.CharField(max_length=80)
    sort = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["entity", "name"], name="uniq_status")]
        ordering = ["entity", "sort", "name"]


class Territory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    state = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    city = models.CharField(max_length=80)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["state", "district", "city"], name="uniq_territory")]
        ordering = ["state", "district", "city"]


class Campaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    source = models.CharField(max_length=80)
    spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["source"])]


class Dealer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    company_name = models.CharField(max_length=160)
    brands = ArrayField(models.CharField(max_length=80), default=list, blank=True)
    contact_name = models.CharField(max_length=160)
    mobile = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    state = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    territory = models.CharField(max_length=200, blank=True)
    products = ArrayField(models.CharField(max_length=80), default=list, blank=True)
    agreement_status = models.CharField(max_length=40, default="Pending")
    payout_terms = models.TextField(blank=True)
    status = models.CharField(max_length=40, default="New")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status"]), models.Index(fields=["state"])]

    def __str__(self):
        return self.company_name


class Vendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    company_name = models.CharField(max_length=160)
    contact_name = models.CharField(max_length=160)
    mobile = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    service_area = models.CharField(max_length=160, blank=True)
    products = ArrayField(models.CharField(max_length=80), default=list, blank=True)
    capacity = models.CharField(max_length=160, blank=True)
    install_capability = models.CharField(max_length=160, blank=True)
    pricing_reference = models.CharField(max_length=200, blank=True)
    agreement_status = models.CharField(max_length=40, default="Pending")
    payout_terms = models.TextField(blank=True)
    status = models.CharField(max_length=40, default="New")
    state = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return self.company_name


class FinancePartner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=160)
    partner_type = models.CharField(max_length=40)
    products = ArrayField(models.CharField(max_length=80), default=list, blank=True)
    states = ArrayField(models.CharField(max_length=80), default=list, blank=True)
    loan_types = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    amount_min = models.DecimalField(max_digits=14, decimal_places=2)
    amount_max = models.DecimalField(max_digits=14, decimal_places=2)
    document_checklist = models.TextField(blank=True)
    rm_name = models.CharField(max_length=160, blank=True)
    rm_mobile = models.CharField(max_length=20, blank=True)
    portal_reference = models.CharField(max_length=200, blank=True)
    payout_terms = models.TextField(blank=True)
    status = models.CharField(max_length=40, default="Active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return self.name


class Requirement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="requirements")
    category = models.CharField(max_length=40)
    product_name = models.CharField(max_length=120)
    details = models.TextField(blank=True)
    budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    loan_required = models.BooleanField(default=False)
    loan_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=40, default="Open")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["customer"]),
            models.Index(fields=["status"]),
            models.Index(fields=["category"]),
        ]


class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="leads")
    requirement = models.OneToOneField(Requirement, null=True, blank=True, on_delete=models.SET_NULL, related_name="lead")
    source = models.CharField(max_length=80)
    category = models.CharField(max_length=40)
    product_name = models.CharField(max_length=120)
    requirement_text = models.TextField(blank=True)
    budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    loan_required = models.BooleanField(default=False)
    loan_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    assigned_to = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_leads")
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_leads")
    dealer = models.ForeignKey(Dealer, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads")
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads")
    priority = models.CharField(max_length=8, choices=[(item, item) for item in PRIORITIES], default="WARM")
    status = models.CharField(max_length=40, default="New")
    pipeline_stage = models.CharField(max_length=40, default="Lead Inbound")
    stage_updated_at = models.DateTimeField()
    dealer_status = models.CharField(max_length=40, default="Pending")
    next_follow_up = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    state = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    pincode = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["pipeline_stage"]),
            models.Index(fields=["stage_updated_at"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["assigned_to"]),
            models.Index(fields=["dealer"]),
            models.Index(fields=["vendor"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["source"]),
            models.Index(fields=["category"]),
            models.Index(fields=["customer"]),
        ]
        ordering = ["-created_at"]


class LoanCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.SET_NULL, related_name="loan_cases")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="loan_cases")
    requirement = models.ForeignKey(Requirement, null=True, blank=True, on_delete=models.SET_NULL, related_name="loan_cases")
    product_name = models.CharField(max_length=120)
    loan_type = models.CharField(max_length=40)
    loan_amount = models.DecimalField(max_digits=14, decimal_places=2)
    lender = models.ForeignKey(FinancePartner, null=True, blank=True, on_delete=models.SET_NULL, related_name="loan_cases")
    dealer = models.ForeignKey(Dealer, null=True, blank=True, on_delete=models.SET_NULL, related_name="loan_cases")
    executive = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="loan_cases")
    login_date = models.DateTimeField(null=True, blank=True)
    application_number = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=40, default="New")
    sanction_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    sanction_date = models.DateTimeField(null=True, blank=True)
    disbursement_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    disbursement_date = models.DateTimeField(null=True, blank=True)
    query_note = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["lead"]),
            models.Index(fields=["executive"]),
            models.Index(fields=["lender"]),
            models.Index(fields=["created_at"]),
        ]
        ordering = ["-created_at"]


class StatusEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan_case = models.ForeignKey(LoanCase, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=40, blank=True)
    to_status = models.CharField(max_length=40)
    note = models.TextField(blank=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["loan_case"])]
        ordering = ["created_at"]


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan_case = models.ForeignKey(LoanCase, null=True, blank=True, on_delete=models.CASCADE, related_name="documents")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=80)
    status = models.CharField(max_length=20, default="Pending")
    file_name = models.CharField(max_length=200, blank=True)
    storage_key = models.CharField(max_length=300, blank=True)
    mime_type = models.CharField(max_length=80, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["loan_case"]),
            models.Index(fields=["lead"]),
            models.Index(fields=["doc_type"]),
        ]


class FollowUp(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="follow_ups")
    loan_case = models.ForeignKey(LoanCase, null=True, blank=True, on_delete=models.CASCADE, related_name="follow_ups")
    assignee = models.ForeignKey(User, on_delete=models.PROTECT, related_name="follow_ups")
    type = models.CharField(max_length=40)
    due_at = models.DateTimeField()
    result = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["due_at"]),
            models.Index(fields=["assignee"]),
            models.Index(fields=["lead"]),
            models.Index(fields=["completed_at"]),
        ]
        ordering = ["due_at"]


class Payout(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan_case = models.ForeignKey(LoanCase, on_delete=models.CASCADE, related_name="payouts")
    partner_kind = models.CharField(max_length=40)
    partner_name = models.CharField(max_length=160)
    transaction_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    expected_payout = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    actual_payout = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    invoice_no = models.CharField(max_length=80, blank=True)
    deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_received = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    payout_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=40, default="Expected")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status"]), models.Index(fields=["loan_case"])]


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=160)
    body = models.TextField()
    href = models.CharField(max_length=200, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "read"])]
        ordering = ["-created_at"]


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    entity = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    action = models.CharField(max_length=80)
    field = models.CharField(max_length=80, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["entity", "entity_id"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["user"]),
        ]
        ordering = ["-created_at"]


class Counter(models.Model):
    id = models.CharField(primary_key=True, max_length=40)
    value = models.PositiveIntegerField(default=0)
