ROLES = [
    "SUPER_ADMIN",
    "ADMIN",
    "SALES_MANAGER",
    "SALES_EXECUTIVE",
    "FINANCE_MANAGER",
    "FINANCE_EXECUTIVE",
    "DEALER",
    "VENDOR",
    "ACCOUNTS",
    "MANAGEMENT",
]

ROLE_LABELS = {
    "SUPER_ADMIN": "Super admin",
    "ADMIN": "Admin",
    "SALES_MANAGER": "Sales manager",
    "SALES_EXECUTIVE": "Sales executive",
    "FINANCE_MANAGER": "Finance manager",
    "FINANCE_EXECUTIVE": "Finance executive",
    "DEALER": "Dealer",
    "VENDOR": "Vendor",
    "ACCOUNTS": "Accounts",
    "MANAGEMENT": "Management",
}

CATEGORIES = ["Agriculture", "Solar", "Finance", "Insurance"]

LEAD_SOURCES = [
    "Website",
    "Google",
    "Facebook",
    "Instagram",
    "YouTube",
    "WhatsApp",
    "Dealer",
    "Vendor",
    "Referral",
    "Walk-in",
    "Call",
    "Employee",
    "Other",
]

DSA_PIPELINE = [
    "Lead Inbound",
    "Documents Collected",
    "Submitted to PolicyBazaar",
    "Bank Verification",
    "Disbursed",
]

DSA_CHECKLIST = ["PAN", "Aadhaar", "ITR", "Bank statement"]
DSA_REQUIRED_DOCS = ["PAN", "Aadhaar", "Bank statement"]
STALE_FILE_HOURS = 48

WHATSAPP_TEMPLATES = [
    {"id": "logged", "label": "File logged", "text": "Hi {name}, your {product} file {code} has been logged."},
    {"id": "missing", "label": "Documents pending", "text": "Hi {name}, we still need these documents: {missing}. Please share them here."},
    {"id": "stage", "label": "Status update", "text": "Hi {name}, your {product} file {code} is now at {stage}."},
]

LEAD_STATUSES = [
    "New",
    "Contacted",
    "Interested",
    "Documents Pending",
    "Documents Received",
    "Not Interested",
    "Closed",
]

LOAN_STATUSES = [
    "New",
    "Documents Pending",
    "Documents Received",
    "Application Ready",
    "Login",
    "Processing",
    "Query Raised",
    "Query Resolved",
    "Sanction",
    "Agreement",
    "Disbursement",
    "Payout Pending",
    "Payout Received",
    "Closed",
    "Rejected",
    "Cancelled",
    "Not Eligible",
    "Customer Not Interested",
]

DOCUMENT_TYPES = [
    "KYC",
    "PAN",
    "Address proof",
    "Bank statement",
    "Income proof",
    "Quotation",
    "RC / asset documents",
    "Other",
]

DOCUMENT_STATUSES = ["Pending", "Uploaded", "Verified", "Rejected", "N/A"]

FOLLOWUP_TYPES = [
    "Call",
    "WhatsApp",
    "Email",
    "Dealer Follow-up",
    "Document Follow-up",
    "Lender Follow-up",
    "Customer Visit",
    "Payment Follow-up",
]

FOLLOWUP_RESULTS = [
    "Connected",
    "Not Connected",
    "Interested",
    "Not Interested",
    "Callback",
    "Documents Pending",
    "Converted",
]

PAYOUT_STATUSES = ["Expected", "Invoice", "Approved", "Received", "Pending", "Disputed"]

DEALER_LEAD_STATUSES = [
    "Pending",
    "Accepted",
    "Rejected",
    "Contacted",
    "Quotation",
    "Booking",
    "Delivered",
    "Closed",
]

PARTNER_TYPES = ["Bank", "NBFC", "Other"]
DEALER_STATUSES = ["New", "Verification", "Active", "Hold", "Inactive"]
AGREEMENT_STATUSES = ["Pending", "Active", "Expired"]

PRODUCTS = [
    ("Agriculture", "Tractor"),
    ("Agriculture", "Used Tractor"),
    ("Agriculture", "Rotavator"),
    ("Agriculture", "Harvester"),
    ("Agriculture", "Cultivator"),
    ("Agriculture", "Seed Drill"),
    ("Agriculture", "Thresher"),
    ("Agriculture", "Other Machinery"),
    ("Solar", "Residential Solar"),
    ("Solar", "Commercial Solar"),
    ("Solar", "Solar Pump"),
    ("Solar", "Inverter"),
    ("Solar", "Battery"),
    ("Solar", "Other Solar Products"),
    ("Finance", "Tractor Loan"),
    ("Finance", "Agriculture Machinery Loan"),
    ("Finance", "Auto Loan"),
    ("Finance", "Used Vehicle Loan"),
    ("Finance", "Home Loan"),
    ("Finance", "Personal Loan"),
    ("Finance", "Loan Against Property"),
    ("Finance", "Balance Transfer"),
    ("Finance", "Business Loan"),
    ("Finance", "Other Loan"),
    ("Insurance", "Motor Insurance"),
    ("Insurance", "Health Insurance"),
    ("Insurance", "Life Insurance"),
    ("Insurance", "General Insurance"),
    ("Insurance", "Other Insurance"),
]

CONTACTED_STATUSES = {"Contacted", "Interested", "Documents Pending", "Documents Received", "Not Interested", "Closed"}
INTERESTED_STATUSES = {"Interested", "Documents Pending", "Documents Received", "Closed"}
DOCUMENT_LEAD_STATUSES = {"Documents Pending", "Documents Received", "Closed"}
LOGIN_PLUS = {
    "Login",
    "Processing",
    "Query Raised",
    "Query Resolved",
    "Sanction",
    "Agreement",
    "Disbursement",
    "Payout Pending",
    "Payout Received",
    "Closed",
}
SANCTION_PLUS = {"Sanction", "Agreement", "Disbursement", "Payout Pending", "Payout Received", "Closed"}
DISBURSEMENT_PLUS = {"Disbursement", "Payout Pending", "Payout Received", "Closed"}

LENDER_DECISION_NOTE = (
    "ADYRA records the case. The lender, insurer, or vendor makes the final decision. This screen is not an approval."
)

PRIORITIES = ["HOT", "WARM", "COLD"]
READY_DOC_STATUSES = {"Uploaded", "Verified", "N/A"}
STATUS_FOR_STAGE = {
    "Lead Inbound": "New",
    "Documents Collected": "Documents Received",
    "Submitted to PolicyBazaar": "Interested",
    "Bank Verification": "Interested",
    "Disbursed": "Closed",
}
DEMO_PASSWORD = "Adrya@2026"
