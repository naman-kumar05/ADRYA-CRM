import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { loanScope } from "@/lib/scope";
import { inr, when } from "@/lib/format";
import { NoAccess, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Loan cases" };

export default async function LoansPage() {
  const user = await requireUser();
  if (!can(user.role, "loans.read")) return <NoAccess />;
  const loans = await prisma.loanCase.findMany({
    where: loanScope(user),
    include: { customer: true, lender: true, executive: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <div>
      <PageHeader eyebrow="Finance" title="Loan cases" description="Status moves from documents to login, sanction, disbursement and payout. The lender still decides." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Case</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Lender</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  <Link href={`/loans/${loan.id}`} className="font-semibold text-field">
                    {loan.code}
                  </Link>
                  <div className="text-xs text-muted">{when(loan.createdAt, false)}</div>
                </td>
                <td className="px-3 py-3">{loan.customer.name}</td>
                <td className="px-3 py-3">{loan.lender?.name || "—"}</td>
                <td className="px-3 py-3">{loan.status}</td>
                <td className="px-3 py-3">{inr(loan.loanAmount.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
