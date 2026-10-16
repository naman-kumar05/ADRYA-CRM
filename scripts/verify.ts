import { prisma } from "../src/lib/db";
import { createLeadRecord } from "../src/lib/leads";
import { leadScope } from "../src/lib/scope";
import { netPayout } from "../src/lib/payouts";
import { signSession } from "../src/lib/session";
import type { CurrentUser } from "../src/lib/auth";
import type { User } from "@prisma/client";

const base = process.env.BASE_URL || "http://localhost:3000";
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  else console.log(`ok  ${name}`);
}

function asUser(user: User): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    dealerId: user.dealerId,
    vendorId: user.vendorId,
  };
}

async function html(path: string, user: User) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const response = await fetch(`${base}${path}`, {
    headers: { cookie: `adrya_session=${token}` },
    redirect: "manual",
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function main() {
  const [admin, amit, dealer, vendor, finance, management] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "ops@adrya.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "amit@adrya.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "dealer@abctractors.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "vendor@surya.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "finance@adrya.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "management@adrya.test" } }),
  ]);

  const before = await prisma.customer.count();
  const blocked = await createLeadRecord(asUser(admin), {
    name: "Ramesh Kumar",
    mobile: "9811100001",
    state: "Uttar Pradesh",
    district: "Meerut",
    city: "Meerut",
    source: "Call",
    category: "Solar",
    productName: "Solar Pump",
    loanRequired: true,
    loanAmount: 150000,
    budget: null,
    priority: "WARM",
  });
  check("duplicate mobile is blocked", !blocked.ok && !!blocked.duplicate && blocked.duplicate.name === "Ramesh Kumar");

  const linked = await createLeadRecord(asUser(admin), {
    name: "Ramesh Kumar",
    mobile: "9811100001",
    state: "Uttar Pradesh",
    district: "Meerut",
    city: "Meerut",
    source: "Call",
    category: "Solar",
    productName: "Solar Pump",
    loanRequired: true,
    loanAmount: 150000,
    budget: null,
    priority: "HOT",
    duplicateChoice: "requirement",
    assignedToId: amit.id,
  });
  check("new requirement reuses the customer", linked.ok && (await prisma.customer.count()) === before);
  if (linked.ok) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: linked.id }, include: { requirement: true, customer: true } });
    check("linked lead keeps Ramesh", lead.customer.code.startsWith("ADY-CU-"));
    await prisma.auditLog.deleteMany({ where: { entityId: lead.id } });
    await prisma.notification.deleteMany({ where: { href: `/leads/${lead.id}` } });
    await prisma.lead.delete({ where: { id: lead.id } });
    if (lead.requirementId) await prisma.requirement.delete({ where: { id: lead.requirementId } });
  }

  const [allLeads, amitLeads, dealerLeads, vendorLeads] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: leadScope(asUser(amit)) }),
    prisma.lead.findMany({ where: leadScope(asUser(dealer)), select: { dealerId: true, customer: { select: { name: true } } } }),
    prisma.lead.findMany({ where: leadScope(asUser(vendor)), select: { vendorId: true } }),
  ]);
  check("executive sees fewer leads than the company", amitLeads < allLeads);
  check("dealer leads all belong to that dealer", dealerLeads.length > 0 && dealerLeads.every((lead) => lead.dealerId === dealer.dealerId));
  check("dealer cannot see Imran", dealerLeads.every((lead) => lead.customer.name !== "Imran Khan"));
  check("vendor leads all belong to that vendor", vendorLeads.length > 0 && vendorLeads.every((lead) => lead.vendorId === vendor.vendorId));
  check("payout net is actual minus deductions", netPayout(15000, 500) === 14500);

  const received = await prisma.payout.findFirst({ where: { status: "Received" } });
  check("received payout stored the net", Number(received?.netReceived) === 14500);

  const financeCases = await prisma.loanCase.count({ where: { executiveId: finance.id } });
  const otherCases = await prisma.loanCase.count({ where: { executiveId: { not: finance.id } } });
  check("finance executive has assigned cases", financeCases > 0 && otherCases === 0);

  const login = await fetch(`${base}/login`);
  check("login page renders", login.status === 200 && (await login.text()).includes("Sign in"));
  const home = await fetch(`${base}/`, { redirect: "manual" });
  check("home sends guests to login", home.status >= 300 && home.status < 400);

  const dashboard = await html("/dashboard", admin);
  check("dashboard is live data", dashboard.status === 200 && dashboard.body.includes("Lead funnel") && dashboard.body.includes("Live from the database"));
  const leads = await html("/leads", admin);
  check("lead list shows Ramesh", leads.status === 200 && leads.body.includes("Ramesh Kumar") && leads.body.includes("ADY-"), `status ${leads.status}`);
  const ramesh = await prisma.lead.findFirst({ where: { customer: { mobile: "9811100001" } } });
  const detail = ramesh ? await html(`/leads/${ramesh.id}`, admin) : { status: 0, body: "" };
  check("lead detail opens the requirement", detail.status === 200 && detail.body.includes("New tractor"));
  const overdue = await html("/follow-ups?view=overdue", amit);
  check("overdue follow-up is listed", overdue.status === 200 && overdue.body.includes("overdue"));
  const dealerView = await html("/leads", dealer);
  check(
    "dealer page hides other customers",
    dealerView.status === 200 && dealerView.body.includes("Ramesh Kumar") && !dealerView.body.includes("Imran Khan"),
    `status ${dealerView.status}`,
  );
  const managementHome = await html("/dashboard", management);
  check("management cannot create leads", managementHome.status === 200 && !managementHome.body.includes("New lead"));

  const loan = await prisma.loanCase.findFirst({ where: { status: "Processing" }, include: { events: true } });
  const loanPage = loan ? await html(`/loans/${loan.id}`, admin) : { status: 0, body: "" };
  check("loan case shows lender disclaimer and timeline", loanPage.status === 200 && loanPage.body.includes("final decision") && loanPage.body.includes("File logged"));

  const intake = await fetch(`${base}/api/intake`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.INTAKE_API_KEY || "" },
    body: JSON.stringify({
      name: "Website Test",
      mobile: "9811199999",
      category: "Agriculture",
      productName: "Thresher",
      state: "Haryana",
      district: "Hisar",
      city: "Hisar",
    }),
  });
  const intakeBody = await intake.json();
  check("website intake returns a lead id", intake.status === 200 && String(intakeBody.leadId).startsWith("ADY-"));
  if (intake.status === 200) {
    const created = await prisma.lead.findFirst({ where: { code: intakeBody.leadId }, include: { customer: true, requirement: true } });
    if (created) {
      await prisma.auditLog.deleteMany({ where: { entityId: created.id } });
      await prisma.lead.delete({ where: { id: created.id } });
      if (created.requirementId) await prisma.requirement.delete({ where: { id: created.requirementId } });
      await prisma.customer.delete({ where: { id: created.customerId } });
    }
  }
  const denied = await fetch(`${base}/api/intake`, { method: "POST", body: "{}" });
  check("intake rejects a missing key", denied.status === 401);

  for (const path of ["/customers", "/requirements", "/dealers", "/vendors", "/partners", "/loans", "/payouts", "/reports", "/settings", "/audit", "/notifications", "/follow-ups"]) {
    const page = await html(path, admin);
    check(`${path} renders`, page.status === 200 && !page.body.includes("Application error"), `status ${page.status}`);
  }
  const dealerSettings = await html("/settings", dealer);
  check("dealer cannot open settings", dealerSettings.body.includes("outside your role"));

  if (failures.length) {
    console.error(failures.map((item) => `FAIL ${item}`).join("\n"));
    process.exit(1);
  }
  console.log("All checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
