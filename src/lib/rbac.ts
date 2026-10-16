import type { Role } from "./constants";

export type Action =
  | "leads.read"
  | "leads.write"
  | "leads.assign"
  | "dealer.status"
  | "customers.read"
  | "customers.write"
  | "dealers.read"
  | "dealers.write"
  | "vendors.read"
  | "vendors.write"
  | "partners.read"
  | "partners.write"
  | "loans.read"
  | "loans.create"
  | "loans.update"
  | "documents.write"
  | "followups.read"
  | "followups.write"
  | "payouts.read"
  | "payouts.write"
  | "reports.read"
  | "settings.read"
  | "settings.write"
  | "audit.read";

const GRANTS: Record<Action, Role[]> = {
  "leads.read": [
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
  ],
  "leads.write": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE"],
  "leads.assign": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
  "dealer.status": ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "DEALER"],
  "customers.read": [
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
  ],
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
  "followups.read": [
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
  ],
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
};

export function can(role: Role, action: Action) {
  return GRANTS[action].includes(role);
}

export function seesFullHistory(role: Role) {
  return ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "MANAGEMENT", "FINANCE_MANAGER", "ACCOUNTS"].includes(role);
}

export type NavItem = { href: string; label: string };

export function navFor(role: Role): NavItem[] {
  const items: { href: string; label: string; show: boolean }[] = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/pipeline", label: "Pipeline", show: can(role, "leads.read") },
    { href: "/leads", label: "Leads", show: can(role, "leads.read") },
    {
      href: "/customers",
      label: "Customers",
      show: can(role, "customers.read") && !["DEALER", "VENDOR"].includes(role),
    },
    {
      href: "/requirements",
      label: "Requirements",
      show: ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE", "FINANCE_MANAGER", "MANAGEMENT"].includes(role),
    },
    { href: "/follow-ups", label: "Follow-ups", show: can(role, "followups.read") && role !== "ACCOUNTS" && role !== "MANAGEMENT" },
    { href: "/dealers", label: "Dealers", show: can(role, "dealers.read") },
    { href: "/vendors", label: "Vendors", show: can(role, "vendors.read") },
    { href: "/partners", label: "Finance partners", show: can(role, "partners.read") },
    { href: "/loans", label: "Loan cases", show: can(role, "loans.read") && role !== "DEALER" },
    { href: "/payouts", label: "Payouts", show: can(role, "payouts.read") },
    { href: "/reports", label: "Reports", show: can(role, "reports.read") },
    { href: "/settings", label: "Settings", show: can(role, "settings.read") },
    { href: "/audit", label: "Audit log", show: can(role, "audit.read") },
  ];
  return items.filter((item) => item.show).map(({ href, label }) => ({ href, label }));
}
