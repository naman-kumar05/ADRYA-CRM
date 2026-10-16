import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { LEAD_SOURCES, LEAD_STATUSES, LOAN_STATUSES, PRODUCTS } from "../src/lib/constants";
import { nextCode } from "../src/lib/ids";
import { createLeadRecord, updateLeadRecord } from "../src/lib/leads";
import { createLoanCaseRecord, updateLoanCaseRecord } from "../src/lib/loans";
import { savePayoutRecord } from "../src/lib/payouts";
import type { CurrentUser } from "../src/lib/auth";
import type { User } from "@prisma/client";

const PASSWORD = "Adrya@2026";

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

function daysFromNow(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@adrya.test" } });
  if (existing) {
    console.log("Already seeded. Sign in with admin@adrya.test");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const places = [
    ["Uttar Pradesh", "Meerut", "Meerut"],
    ["Uttar Pradesh", "Hapur", "Hapur"],
    ["Uttar Pradesh", "Bulandshahr", "Bulandshahr"],
    ["Uttar Pradesh", "Ghaziabad", "Ghaziabad"],
    ["Uttar Pradesh", "Muzaffarnagar", "Muzaffarnagar"],
    ["Rajasthan", "Jaipur", "Jaipur"],
    ["Rajasthan", "Alwar", "Alwar"],
    ["Rajasthan", "Bharatpur", "Bharatpur"],
    ["Maharashtra", "Pune", "Pune"],
    ["Maharashtra", "Nashik", "Nashik"],
    ["Madhya Pradesh", "Bhopal", "Bhopal"],
    ["Madhya Pradesh", "Indore", "Indore"],
    ["Bihar", "Patna", "Patna"],
    ["Haryana", "Karnal", "Karnal"],
    ["Haryana", "Hisar", "Hisar"],
  ];

  await prisma.territory.createMany({
    data: places.map(([state, district, city]) => ({ state, district, city })),
  });
  await prisma.product.createMany({ data: PRODUCTS });
  await prisma.leadSource.createMany({ data: LEAD_SOURCES.map((name) => ({ name })) });
  await prisma.statusOption.createMany({
    data: [
      ...LEAD_STATUSES.map((name, sort) => ({ entity: "lead", name, sort })),
      ...LOAN_STATUSES.map((name, sort) => ({ entity: "loan", name, sort })),
    ],
  });
  await prisma.campaign.createMany({
    data: [
      { name: "Google search — tractor", source: "Google", spend: 25000 },
      { name: "Facebook lead ads", source: "Facebook", spend: 15000 },
      { name: "Dealer counter", source: "Dealer", spend: 0 },
    ],
  });

  const dealer = await prisma.$transaction(async (tx) =>
    tx.dealer.create({
      data: {
        code: await nextCode(tx, "dealer", "ADY-DL", 4),
        companyName: "ABC Tractors",
        brands: ["Mahindra", "Sonalika"],
        contactName: "Rakesh Gupta",
        mobile: "9811200001",
        email: "rakesh@abctractors.test",
        state: "Uttar Pradesh",
        district: "Meerut",
        city: "Meerut",
        territory: "Meerut, Hapur, Bulandshahr",
        products: ["Tractor", "Used Tractor"],
        agreementStatus: "Active",
        payoutTerms: "As per dealer agreement. Enter the case amount; do not assume a percentage.",
        status: "Active",
      },
    }),
  );
  const vendor = await prisma.$transaction(async (tx) =>
    tx.vendor.create({
      data: {
        code: await nextCode(tx, "vendor", "ADY-VN", 4),
        companyName: "Surya Solar",
        contactName: "Neha Verma",
        mobile: "9811200002",
        email: "neha@surya.test",
        serviceArea: "Western UP",
        products: ["Residential Solar", "Solar Pump"],
        capacity: "Up to 10 kW residential",
        installCapability: "Rooftop and pump sets",
        pricingReference: "Current rate card on file",
        agreementStatus: "Active",
        payoutTerms: "Per installation contract",
        status: "Active",
        state: "Uttar Pradesh",
        district: "Meerut",
        city: "Meerut",
      },
    }),
  );

  const partnerInput = [
    {
      name: "Mahindra Finance",
      partnerType: "NBFC",
      products: ["Tractor", "Used Tractor", "Agriculture"],
      states: ["Uttar Pradesh"],
      loanTypes: ["New", "Used"],
      amountMin: 50000,
      amountMax: 2000000,
      rmName: "Amitabh Rao",
      documentChecklist: "KYC, income, quotation, asset documents",
      payoutTerms: "Per executed payout grid for this partner",
    },
    {
      name: "SBI Agri",
      partnerType: "Bank",
      products: ["Agriculture", "Tractor", "Harvester", "Solar Pump"],
      states: ["All"],
      loanTypes: ["New"],
      amountMin: 50000,
      amountMax: 5000000,
      rmName: "Branch RM",
      documentChecklist: "KYC, land records, quotation",
      payoutTerms: "Bank schedule, case by case",
    },
    {
      name: "HDFC Home Loans",
      partnerType: "Bank",
      products: ["Home Loan"],
      states: ["All"],
      loanTypes: ["New"],
      amountMin: 200000,
      amountMax: 10000000,
      rmName: "Home RM",
      documentChecklist: "KYC, income, property papers",
      payoutTerms: "Home loan agreement",
    },
    {
      name: "Tata Capital Auto",
      partnerType: "NBFC",
      products: ["Auto Loan", "Used Vehicle Loan"],
      states: ["All"],
      loanTypes: ["New", "Used"],
      amountMin: 50000,
      amountMax: 3000000,
      rmName: "Auto RM",
      documentChecklist: "KYC, bank statement, quotation",
      payoutTerms: "Auto payout grid on the agreement",
    },
  ];
  const partners = [];
  for (const item of partnerInput) {
    const partner = await prisma.$transaction(async (tx) =>
      tx.financePartner.create({
        data: { ...item, code: await nextCode(tx, "partner", "ADY-FP", 4), status: "Active" },
      }),
    );
    partners.push(partner);
  }

  const people = [
    ["Adrya Admin", "admin@adrya.test", "SUPER_ADMIN"],
    ["Operations Admin", "ops@adrya.test", "ADMIN"],
    ["Sales Manager", "manager@adrya.test", "SALES_MANAGER"],
    ["Amit Sharma", "amit@adrya.test", "SALES_EXECUTIVE"],
    ["Finance Manager", "finance.manager@adrya.test", "FINANCE_MANAGER"],
    ["Finance Executive", "finance@adrya.test", "FINANCE_EXECUTIVE"],
    ["Accounts Desk", "accounts@adrya.test", "ACCOUNTS"],
    ["Management", "management@adrya.test", "MANAGEMENT"],
    ["ABC Tractors", "dealer@abctractors.test", "DEALER"],
    ["Surya Solar", "vendor@surya.test", "VENDOR"],
  ] as const;

  const users: Record<string, User> = {};
  for (const [name, email, role] of people) {
    users[email] = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        monthlyLeadTarget: email === "amit@adrya.test" ? 20 : null,
        dealerId: role === "DEALER" ? dealer.id : null,
        vendorId: role === "VENDOR" ? vendor.id : null,
      },
    });
  }

  const admin = asUser(users["ops@adrya.test"]);
  const amit = users["amit@adrya.test"];
  const finance = users["finance@adrya.test"];
  const accounts = asUser(users["accounts@adrya.test"]);
  const manager = users["manager@adrya.test"];

  const samples = [
    {
      name: "Ramesh Kumar",
      mobile: "9811100001",
      source: "Google",
      category: "Agriculture",
      productName: "Tractor",
      state: "Uttar Pradesh",
      district: "Meerut",
      city: "Meerut",
      loanRequired: true,
      loanAmount: 600000,
      budget: 750000,
      priority: "HOT" as const,
      assignedToId: amit.id,
      dealerId: dealer.id,
      requirementText: "New tractor for wheat season. Looking at 45 HP.",
      status: "Interested",
      createdDaysAgo: 12,
    },
    {
      name: "Suresh Yadav",
      mobile: "9811100002",
      source: "Dealer",
      category: "Agriculture",
      productName: "Used Tractor",
      state: "Uttar Pradesh",
      district: "Hapur",
      city: "Hapur",
      loanRequired: true,
      loanAmount: 450000,
      budget: 480000,
      priority: "WARM" as const,
      assignedToId: amit.id,
      dealerId: dealer.id,
      requirementText: "Used tractor, budget under 5 lakh.",
      status: "Contacted",
      createdDaysAgo: 6,
    },
    {
      name: "Mohan Lal",
      mobile: "9811100003",
      source: "Website",
      category: "Solar",
      productName: "Solar Pump",
      state: "Uttar Pradesh",
      district: "Bulandshahr",
      city: "Bulandshahr",
      loanRequired: true,
      loanAmount: 180000,
      budget: 210000,
      priority: "WARM" as const,
      assignedToId: amit.id,
      vendorId: vendor.id,
      requirementText: "5 HP solar pump for irrigation.",
      status: "Documents Pending",
      createdDaysAgo: 4,
    },
    {
      name: "Imran Khan",
      mobile: "9811100004",
      source: "Facebook",
      category: "Finance",
      productName: "Auto Loan",
      state: "Uttar Pradesh",
      district: "Ghaziabad",
      city: "Ghaziabad",
      loanRequired: true,
      loanAmount: 500000,
      budget: 500000,
      priority: "HOT" as const,
      assignedToId: amit.id,
      requirementText: "Commercial vehicle loan.",
      status: "Interested",
      createdDaysAgo: 20,
    },
    {
      name: "Kavita Singh",
      mobile: "9811100005",
      source: "Referral",
      category: "Finance",
      productName: "Home Loan",
      state: "Rajasthan",
      district: "Jaipur",
      city: "Jaipur",
      loanRequired: true,
      loanAmount: 2500000,
      budget: 2500000,
      priority: "WARM" as const,
      assignedToId: amit.id,
      requirementText: "Home purchase in Jaipur.",
      status: "Documents Pending",
      createdDaysAgo: 8,
    },
    {
      name: "Sunita Devi",
      mobile: "9811100006",
      source: "Instagram",
      category: "Solar",
      productName: "Residential Solar",
      state: "Maharashtra",
      district: "Nashik",
      city: "Nashik",
      loanRequired: false,
      loanAmount: null,
      budget: 220000,
      priority: "WARM" as const,
      assignedToId: amit.id,
      vendorId: vendor.id,
      requirementText: "3 kW rooftop. No loan.",
      status: "New",
      createdDaysAgo: 2,
    },
    {
      name: "Harish Patel",
      mobile: "9811100007",
      source: "Call",
      category: "Insurance",
      productName: "Motor Insurance",
      state: "Haryana",
      district: "Karnal",
      city: "Karnal",
      loanRequired: false,
      loanAmount: null,
      budget: 12000,
      priority: "COLD" as const,
      assignedToId: amit.id,
      requirementText: "Tractor insurance renewal.",
      status: "Interested",
      createdDaysAgo: 3,
    },
    {
      name: "Deepak Sharma",
      mobile: "9811100008",
      source: "Walk-in",
      category: "Agriculture",
      productName: "Harvester",
      state: "Rajasthan",
      district: "Alwar",
      city: "Alwar",
      loanRequired: true,
      loanAmount: 900000,
      budget: 1400000,
      priority: "COLD" as const,
      assignedToId: amit.id,
      requirementText: "Asked for a price, then declined.",
      status: "Not Interested",
      createdDaysAgo: 15,
    },
    {
      name: "Pooja Kumari",
      mobile: "9811100009",
      source: "WhatsApp",
      category: "Agriculture",
      productName: "Tractor",
      state: "Uttar Pradesh",
      district: "Meerut",
      city: "Meerut",
      loanRequired: true,
      loanAmount: 550000,
      budget: 700000,
      priority: "HOT" as const,
      assignedToId: amit.id,
      dealerId: dealer.id,
      requirementText: "Called this morning.",
      status: "New",
      createdDaysAgo: 0,
    },
    {
      name: "Nitin Rao",
      mobile: "9811100010",
      source: "Website",
      category: "Agriculture",
      productName: "Cultivator",
      state: "Bihar",
      district: "Patna",
      city: "Patna",
      loanRequired: false,
      loanAmount: null,
      budget: 80000,
      priority: "WARM" as const,
      assignedToId: manager.id,
      requirementText: "Website form, cultivator quote.",
      status: "New",
      createdDaysAgo: 0,
    },
  ];

  const leadIds: Record<string, string> = {};
  for (const sample of samples) {
    const created = await createLeadRecord(admin, {
      name: sample.name,
      mobile: sample.mobile,
      state: sample.state,
      district: sample.district,
      city: sample.city,
      source: sample.source,
      category: sample.category,
      productName: sample.productName,
      loanRequired: sample.loanRequired,
      loanAmount: sample.loanAmount,
      budget: sample.budget,
      priority: sample.priority,
      assignedToId: sample.assignedToId,
      dealerId: "dealerId" in sample ? sample.dealerId : null,
      vendorId: "vendorId" in sample ? sample.vendorId : null,
      requirementText: sample.requirementText,
    });
    if (!created.ok) throw new Error(created.error);
    leadIds[sample.mobile] = created.id;
    await updateLeadRecord(admin, created.id, { status: sample.status });
    if (sample.createdDaysAgo) {
      await prisma.lead.update({
        where: { id: created.id },
        data: { createdAt: daysFromNow(-sample.createdDaysAgo, 9) },
      });
    }
  }

  const ramesh = await createLoanCaseRecord(admin, {
    leadId: leadIds["9811100001"],
    lenderId: partners[0].id,
    executiveId: finance.id,
    loanType: "New",
    loanAmount: 600000,
    remarks: "Customer comparing two dealers.",
  });
  if (!ramesh.ok) throw new Error(ramesh.error);
  await updateLoanCaseRecord(asUser(users["finance.manager@adrya.test"]), ramesh.id, {
    status: "Processing",
    note: "File logged with the lender",
    applicationNumber: "MF-UP-2291",
    loginDate: daysFromNow(-3),
  });
  await prisma.document.updateMany({
    where: { loanCaseId: ramesh.id, docType: { in: ["KYC", "PAN", "Address proof", "Quotation"] } },
    data: { status: "Verified" },
  });
  await prisma.document.updateMany({
    where: { loanCaseId: ramesh.id, docType: "Bank statement" },
    data: { status: "Uploaded" },
  });

  const imran = await createLoanCaseRecord(admin, {
    leadId: leadIds["9811100004"],
    lenderId: partners[3].id,
    executiveId: finance.id,
    loanType: "New",
    loanAmount: 500000,
  });
  if (!imran.ok) throw new Error(imran.error);
  await updateLoanCaseRecord(asUser(users["finance.manager@adrya.test"]), imran.id, {
    status: "Disbursement",
    note: "Lender confirmed disbursement",
    applicationNumber: "TC-44120",
    sanctionAmount: 480000,
    sanctionDate: daysFromNow(-10),
    disbursementAmount: 480000,
    disbursementDate: daysFromNow(-4),
    loginDate: daysFromNow(-18),
  });

  const kavita = await createLoanCaseRecord(admin, {
    leadId: leadIds["9811100005"],
    lenderId: partners[2].id,
    executiveId: finance.id,
    loanType: "New",
    loanAmount: 2500000,
  });
  if (!kavita.ok) throw new Error(kavita.error);
  await updateLoanCaseRecord(asUser(users["finance.manager@adrya.test"]), kavita.id, {
    status: "Documents Pending",
    note: "Income proof still open",
  });

  await savePayoutRecord(accounts, {
    loanCaseId: imran.id,
    partnerKind: "Lender",
    partnerName: "Tata Capital Auto",
    transactionAmount: 480000,
    expectedPayout: 18000,
    actualPayout: 15000,
    deductions: 500,
    invoiceNo: "INV-2401",
    payoutDate: daysFromNow(-2),
    status: "Received",
    notes: "Short payout against the contract grid. Net is actual minus deductions.",
  });
  await savePayoutRecord(accounts, {
    loanCaseId: ramesh.id,
    partnerKind: "Lender",
    partnerName: "Mahindra Finance",
    transactionAmount: 600000,
    expectedPayout: 12000,
    actualPayout: null,
    deductions: 0,
    status: "Expected",
    notes: "Expected only. Not received.",
  });

  await prisma.followUp.createMany({
    data: [
      {
        leadId: leadIds["9811100001"],
        assigneeId: amit.id,
        type: "Call",
        dueAt: daysFromNow(1, 11),
        notes: "Confirm dealer visit",
      },
      {
        leadId: leadIds["9811100002"],
        assigneeId: amit.id,
        type: "Dealer Follow-up",
        dueAt: daysFromNow(-1, 16),
        notes: "Dealer has not accepted yet",
      },
      {
        leadId: leadIds["9811100005"],
        loanCaseId: kavita.id,
        assigneeId: finance.id,
        type: "Document Follow-up",
        dueAt: daysFromNow(0, 15),
        notes: "Ask for income proof",
      },
      {
        leadId: leadIds["9811100004"],
        loanCaseId: imran.id,
        assigneeId: amit.id,
        type: "Call",
        dueAt: daysFromNow(-6, 12),
        completedAt: daysFromNow(-6, 12),
        result: "Converted",
        notes: "Customer confirmed disbursement",
      },
    ],
  });

  await prisma.lead.update({
    where: { id: leadIds["9811100001"] },
    data: { dealerStatus: "Accepted", nextFollowUp: daysFromNow(1, 11) },
  });
  await prisma.lead.update({
    where: { id: leadIds["9811100002"] },
    data: { dealerStatus: "Pending", nextFollowUp: daysFromNow(-1, 16) },
  });

  console.log(`Seeded ADYRA CRM. Password for every demo login: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
