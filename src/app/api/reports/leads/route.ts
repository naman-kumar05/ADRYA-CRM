import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/scope";

function cell(value: string | null | undefined) {
  const text = value ?? "";
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports.read")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const leads = await prisma.lead.findMany({
    where: leadScope(user),
    include: { customer: true, assignedTo: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const header = ["Lead ID", "Created", "Customer", "Mobile", "Source", "Category", "Product", "Status", "Priority", "City", "Assignee", "Loan amount"];
  const lines = leads.map((lead) =>
    [
      lead.code,
      lead.createdAt.toISOString(),
      lead.customer.name,
      lead.customer.mobile,
      lead.source,
      lead.category,
      lead.productName,
      lead.status,
      lead.priority,
      lead.city,
      lead.assignedTo?.name || "",
      lead.loanAmount?.toString() || "",
    ]
      .map(cell)
      .join(","),
  );
  return new NextResponse([header.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=adrya-leads.csv",
    },
  });
}
