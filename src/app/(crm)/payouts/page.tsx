import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { loanScope } from "@/lib/scope";
import { inr, when } from "@/lib/format";
import { NoAccess, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const user = await requireUser();
  if (!can(user.role, "payouts.read")) return <NoAccess />;
  const payouts = await prisma.payout.findMany({
    where: { loanCase: loanScope(user) },
    include: { loanCase: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const pending = payouts.filter((row) => ["Expected", "Invoice", "Approved", "Pending"].includes(row.status));
  const received = payouts.filter((row) => row.status === "Received");
  const expectedSum = pending.reduce((sum, row) => sum + Number(row.expectedPayout || 0), 0);
  const netSum = received.reduce((sum, row) => sum + Number(row.netReceived || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Payouts"
        description={`Expected still open ${inr(expectedSum)} · net received ${inr(netSum)}. Amounts come from the contract fields, not a built-in percentage.`}
      />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Case</th>
              <th className="px-3 py-3">Partner</th>
              <th className="px-3 py-3">Expected</th>
              <th className="px-3 py-3">Actual</th>
              <th className="px-3 py-3">Deductions</th>
              <th className="px-3 py-3">Net</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  <Link href={`/loans/${payout.loanCaseId}`} className="font-semibold text-field">
                    {payout.loanCase.code}
                  </Link>
                  <div className="text-xs text-muted">{payout.loanCase.customer.name}</div>
                </td>
                <td className="px-3 py-3">
                  {payout.partnerName}
                  <div className="text-xs text-muted">{payout.partnerKind}</div>
                </td>
                <td className="px-3 py-3">{inr(payout.expectedPayout?.toString())}</td>
                <td className="px-3 py-3">{inr(payout.actualPayout?.toString())}</td>
                <td className="px-3 py-3">{inr(payout.deductions.toString())}</td>
                <td className="px-3 py-3">{inr(payout.netReceived?.toString())}</td>
                <td className="px-3 py-3">
                  {payout.status}
                  <div className="text-xs text-muted">{when(payout.payoutDate, false)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
