import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { leadScope, loanScope } from "@/lib/scope";
import { inr } from "@/lib/format";
import { DISBURSEMENT_PLUS, SANCTION_PLUS } from "@/lib/constants";
import { NoAccess, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser();
  if (!can(user.role, "reports.read")) return <NoAccess />;
  const leadsWhere = leadScope(user);
  const loansWhere = loanScope(user);
  const [byStatus, byProduct, bySource, byEmployee, loans, campaigns, payouts] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: leadsWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["productName"], where: leadsWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where: leadsWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedToId", "status"], where: leadsWhere, _count: { _all: true } }),
    prisma.loanCase.groupBy({ by: ["status"], where: loansWhere, _count: { _all: true }, _sum: { loanAmount: true, sanctionAmount: true, disbursementAmount: true } }),
    prisma.campaign.findMany({ where: { active: true } }),
    prisma.payout.findMany({ where: { loanCase: { lead: leadsWhere } }, include: { loanCase: { include: { lead: true } } } }),
  ]);
  const people = await prisma.user.findMany({
    where: { role: { in: ["SALES_EXECUTIVE", "SALES_MANAGER"] } },
    select: { id: true, name: true, monthlyLeadTarget: true },
  });
  const spend = new Map<string, number>();
  for (const campaign of campaigns) spend.set(campaign.source, (spend.get(campaign.source) || 0) + Number(campaign.spend));
  const receivedBySource = new Map<string, number>();
  for (const payout of payouts) {
    const source = payout.loanCase.lead?.source;
    if (!source || payout.status !== "Received") continue;
    receivedBySource.set(source, (receivedBySource.get(source) || 0) + Number(payout.netReceived || 0));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="From live records"
        title="Reports"
        description="These counts use the same filters as the rest of your role."
        action={
          <Link href="/api/reports/leads" className="rounded-xl border border-line bg-card px-4 py-2 text-sm">
            Export leads
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Lead status</h2>
          <ul className="space-y-1 text-sm">
            {byStatus.map((row) => (
              <li key={row.status} className="flex justify-between">
                <span>{row.status}</span>
                <span>{row._count._all}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Products</h2>
          <ul className="space-y-1 text-sm">
            {byProduct.map((row) => (
              <li key={row.productName} className="flex justify-between">
                <span>{row.productName}</span>
                <span>{row._count._all}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Source and spend</h2>
          <ul className="space-y-1 text-sm">
            {bySource.map((row) => (
              <li key={row.source} className="flex justify-between gap-3">
                <span>{row.source}</span>
                <span>
                  {row._count._all} leads · spend {inr(spend.get(row.source) || 0)} · received {inr(receivedBySource.get(row.source) || 0)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Loan pipeline</h2>
          <ul className="space-y-1 text-sm">
            {loans.map((row) => (
              <li key={row.status} className="flex justify-between gap-3">
                <span>{row.status}</span>
                <span>
                  {row._count._all} · {inr(row._sum.loanAmount?.toString())}
                  {SANCTION_PLUS.has(row.status) ? ` · sanctioned ${inr(row._sum.sanctionAmount?.toString())}` : ""}
                  {DISBURSEMENT_PLUS.has(row.status) ? ` · disbursed ${inr(row._sum.disbursementAmount?.toString())}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel>
        <h2 className="mb-3 font-display text-2xl">Employee performance</h2>
        <ul className="space-y-2 text-sm">
          {people.map((person) => {
            const rows = byEmployee.filter((row) => row.assignedToId === person.id);
            const total = rows.reduce((sum, row) => sum + row._count._all, 0);
            return (
              <li key={person.id} className="flex justify-between gap-3">
                <span>{person.name}</span>
                <span>
                  {total} leads{person.monthlyLeadTarget ? ` / target ${person.monthlyLeadTarget}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
