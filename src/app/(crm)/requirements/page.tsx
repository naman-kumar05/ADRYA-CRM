import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirementScope } from "@/lib/scope";
import { inr, when } from "@/lib/format";
import { PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Requirements" };

export default async function RequirementsPage() {
  const user = await requireUser();
  const rows = await prisma.requirement.findMany({
    where: requirementScope(user),
    include: { customer: true, lead: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <div>
      <PageHeader eyebrow="Separate from the customer" title="Requirements" description="Ramesh can want a tractor, then a loan, then solar. Each one has its own id." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Requirement</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Lead</th>
              <th className="px-3 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  {row.code}
                  <div className="text-xs text-muted">{when(row.createdAt, false)}</div>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/customers/${row.customerId}`} className="text-field">
                    {row.customer.name}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  {row.productName}
                  <div className="text-xs text-muted">{row.status}</div>
                </td>
                <td className="px-3 py-3">
                  {row.lead ? (
                    <Link href={`/leads/${row.lead.id}`} className="text-field">
                      {row.lead.code}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3">{inr(row.loanAmount?.toString() || row.budget?.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
