export const ROLES = [
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
] as const;

export type Role = (typeof ROLES)[number];

export const CATEGORIES = ["Agriculture", "Solar", "Finance", "Insurance"] as const;

export const LEAD_SOURCES = [
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
] as const;

export const DSA_PIPELINE = [
  "Lead Inbound",
  "Documents Collected",
  "Submitted to PolicyBazaar",
  "Bank Verification",
  "Disbursed",
] as const;

export type PipelineStage = (typeof DSA_PIPELINE)[number];

export const DSA_CHECKLIST = ["PAN", "Aadhaar", "ITR", "Bank statement"] as const;

export const DSA_REQUIRED_DOCS = ["PAN", "Aadhaar", "Bank statement"] as const;

export const STALE_FILE_HOURS = 48;

export const WHATSAPP_TEMPLATES = [
  {
    id: "logged",
    label: "File logged",
    text: "Hi {name}, your {product} file {code} has been logged.",
  },
  {
    id: "missing",
    label: "Documents pending",
    text: "Hi {name}, we still need these documents: {missing}. Please share them here.",
  },
  {
    id: "stage",
    label: "Status update",
    text: "Hi {name}, your {product} file {code} is now at {stage}.",
  },
] as const;

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Documents Pending",
  "Documents Received",
  "Not Interested",
  "Closed",
] as const;

export const LOAN_STATUSES = [
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
] as const;

export const DOCUMENT_TYPES = [
  "KYC",
  "PAN",
  "Address proof",
  "Bank statement",
  "Income proof",
  "Quotation",
  "RC / asset documents",
  "Other",
] as const;

export const DOCUMENT_STATUSES = ["Pending", "Uploaded", "Verified", "Rejected", "N/A"] as const;

export const FOLLOWUP_TYPES = [
  "Call",
  "WhatsApp",
  "Email",
  "Dealer Follow-up",
  "Document Follow-up",
  "Lender Follow-up",
  "Customer Visit",
  "Payment Follow-up",
] as const;

export const FOLLOWUP_RESULTS = [
  "Connected",
  "Not Connected",
  "Interested",
  "Not Interested",
  "Callback",
  "Documents Pending",
  "Converted",
] as const;

export const PAYOUT_STATUSES = ["Expected", "Invoice", "Approved", "Received", "Pending", "Disputed"] as const;

export const DEALER_LEAD_STATUSES = [
  "Pending",
  "Accepted",
  "Rejected",
  "Contacted",
  "Quotation",
  "Booking",
  "Delivered",
  "Closed",
] as const;

export const PARTNER_TYPES = ["Bank", "NBFC", "Other"] as const;

export const DEALER_STATUSES = ["New", "Verification", "Active", "Hold", "Inactive"] as const;

export const AGREEMENT_STATUSES = ["Pending", "Active", "Expired"] as const;

export const PRODUCTS: { category: string; name: string }[] = [
  { category: "Agriculture", name: "Tractor" },
  { category: "Agriculture", name: "Used Tractor" },
  { category: "Agriculture", name: "Rotavator" },
  { category: "Agriculture", name: "Harvester" },
  { category: "Agriculture", name: "Cultivator" },
  { category: "Agriculture", name: "Seed Drill" },
  { category: "Agriculture", name: "Thresher" },
  { category: "Agriculture", name: "Other Machinery" },
  { category: "Solar", name: "Residential Solar" },
  { category: "Solar", name: "Commercial Solar" },
  { category: "Solar", name: "Solar Pump" },
  { category: "Solar", name: "Inverter" },
  { category: "Solar", name: "Battery" },
  { category: "Solar", name: "Other Solar Products" },
  { category: "Finance", name: "Tractor Loan" },
  { category: "Finance", name: "Agriculture Machinery Loan" },
  { category: "Finance", name: "Auto Loan" },
  { category: "Finance", name: "Used Vehicle Loan" },
  { category: "Finance", name: "Home Loan" },
  { category: "Finance", name: "Personal Loan" },
  { category: "Finance", name: "Loan Against Property" },
  { category: "Finance", name: "Balance Transfer" },
  { category: "Finance", name: "Business Loan" },
  { category: "Finance", name: "Other Loan" },
  { category: "Insurance", name: "Motor Insurance" },
  { category: "Insurance", name: "Health Insurance" },
  { category: "Insurance", name: "Life Insurance" },
  { category: "Insurance", name: "General Insurance" },
  { category: "Insurance", name: "Other Insurance" },
];

export const CONTACTED_STATUSES = new Set([
  "Contacted",
  "Interested",
  "Documents Pending",
  "Documents Received",
  "Not Interested",
  "Closed",
]);

export const INTERESTED_STATUSES = new Set([
  "Interested",
  "Documents Pending",
  "Documents Received",
  "Closed",
]);

export const DOCUMENT_LEAD_STATUSES = new Set([
  "Documents Pending",
  "Documents Received",
  "Closed",
]);

export const LOGIN_PLUS = new Set([
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
]);

export const SANCTION_PLUS = new Set([
  "Sanction",
  "Agreement",
  "Disbursement",
  "Payout Pending",
  "Payout Received",
  "Closed",
]);

export const DISBURSEMENT_PLUS = new Set([
  "Disbursement",
  "Payout Pending",
  "Payout Received",
  "Closed",
]);

export const LENDER_DECISION_NOTE =
  "ADYRA records the case. The lender, insurer, or vendor makes the final decision. This screen is not an approval.";
