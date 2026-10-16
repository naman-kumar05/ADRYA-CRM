import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { followUpScope, leadScope, loanScope } from "@/lib/scope";
import { CONTACTED_STATUSES, DISBURSEMENT_PLUS, DOCUMENT_LEAD_STATUSES, INTERESTED_STATUSES, LOGIN_PLUS, SANCTION_PLUS } from "@/lib/constants";
import { inr, startOfDay, startOfMonth, when } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { ensureStaleReminders, staleCutoff } from "@/lib/pipeline";
import { PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Dashboard" };

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ol className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
          <div className="h-2 rounded-full bg-field-2">
            <div className="h-2 rounded-full bg-field" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (can(user.role, "followups.write")) await ensureStaleReminders(user);
  const leadsWhere = leadScope(user);
  const loansWhere = loanScope(user);
  const tasksWhere = followUpScope(user);
  const day = startOfDay();
  const month = startOfMonth();
  const tomorrow = new Date(day);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const now = new Date();

  const contacted = [...CONTACTED_STATUSES];
  const interested = [...INTERESTED_STATUSES];
  const documents = [...DOCUMENT_LEAD_STATUSES];
  const loginPlus = [...LOGIN_PLUS];
  const sanctionPlus = [...SANCTION_PLUS];
  const disbursePlus = [...DISBURSEMENT_PLUS];

  const [
    leadTotal,
    leadsToday,
    leadsMonth,
    contactedCount,
    interestedCount,
    documentCount,
    loginCount,
    sanctionCount,
    disburseCount,
    overdue,
    dueToday,
    byCategory,
    bySource,
    pendingDocs,
    expected,
    received,
    tasks,
    staleFiles,
  ] = await Promise.all([
    prisma.lead.count({ where: leadsWhere }),
    prisma.lead.count({ where: { ...leadsWhere, createdAt: { gte: day } } }),
    prisma.lead.count({ where: { ...leadsWhere, createdAt: { gte: month } } }),
    prisma.lead.count({ where: { ...leadsWhere, status: { in: contacted } } }),
    prisma.lead.count({ where: { ...leadsWhere, status: { in: interested } } }),
    prisma.lead.count({ where: { ...leadsWhere, status: { in: documents } } }),
    prisma.loanCase.count({ where: { ...loansWhere, status: { in: loginPlus } } }),
    prisma.loanCase.count({ where: { ...loansWhere, status: { in: sanctionPlus } } }),
    prisma.loanCase.count({ where: { ...loansWhere, status: { in: disbursePlus } } }),
    prisma.followUp.count({ where: { ...tasksWhere, completedAt: null, dueAt: { lt: now } } }),
    prisma.followUp.count({ where: { ...tasksWhere, completedAt: null, dueAt: { gte: day, lt: tomorrow } } }),
    prisma.lead.groupBy({ by: ["category"], where: leadsWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where: leadsWhere, _count: { _all: true } }),
    prisma.document.count({ where: { status: { in: ["Pending", "Rejected"] }, loanCase: loansWhere } }),
    prisma.payout.aggregate({
      where: { status: { in: ["Expected", "Invoice", "Approved", "Pending"] }, loanCase: loansWhere },
      _sum: { expectedPayout: true },
    }),
    prisma.payout.aggregate({
      where: { status: "Received", loanCase: loansWhere },
      _sum: { netReceived: true },
    }),
    prisma.followUp.findMany({
      where: { ...tasksWhere, completedAt: null, dueAt: { lt: tomorrow } },
      include: { lead: { select: { code: true, customer: { select: { name: true } } } } },
      orderBy: { dueAt: "asc" },
      take: 6,
    }),
    prisma.lead.findMany({
      where: {
        ...leadsWhere,
        stageUpdatedAt: { lt: staleCutoff() },
        pipelineStage: { not: "Disbursed" },
        status: { notIn: ["Not Interested", "Closed"] },
      },
      include: { customer: { select: { name: true, mobile: true } } },
      orderBy: { stageUpdatedAt: "asc" },
      take: 6,
    }),
  ]);

  const kpis = [
    ["Leads today", leadsToday],
    ["Follow-ups due", dueToday],
    ["Overdue", overdue],
    ["Login", loginCount],
    ["Sanction", sanctionCount],
    ["Disbursement", disburseCount],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Live from the database"
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description={`${leadTotal} leads in your view · ${leadsMonth} this month. Login, sanction and disbursement count finance cases.`}
        action={
          can(user.role, "leads.write") ? (
            <Link href="/leads/new" className="rounded-xl bg-field px-4 py-2 text-sm font-semibold text-white">
              New lead
            </Link>
          ) : null
        }
      />
      {staleFiles.length ? (
        <Panel className="mb-4">
          <h2 className="font-display text-2xl">Quiet for 48 hours</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {staleFiles.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/leads/${lead.id}`} className="font-semibold text-field">
                  {lead.customer.name} · {lead.pipelineStage}
                </Link>
                <a href={telHref(lead.customer.mobile)} className="rounded-lg bg-field px-2.5 py-1 text-xs font-semibold text-white">
                  Call
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="mb-4 font-display text-2xl">Lead funnel</h2>
          <Bars
            rows={[
              { label: "Leads", value: leadTotal },
              { label: "Contacted", value: contactedCount },
              { label: "Interested", value: interestedCount },
              { label: "Documents", value: documentCount },
              { label: "Login", value: loginCount },
              { label: "Sanction", value: sanctionCount },
              { label: "Disbursement", value: disburseCount },
            ]}
          />
        </Panel>
        <Panel>
          <h2 className="mb-4 font-display text-2xl">Product mix</h2>
          <Bars rows={byCategory.map((row) => ({ label: row.category, value: row._count._all }))} />
        </Panel>
        <Panel>
          <h2 className="mb-4 font-display text-2xl">Source performance</h2>
          <Bars rows={bySource.map((row) => ({ label: row.source, value: row._count._all }))} />
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {can(user.role, "payouts.read") ? (
          <Panel>
            <h2 className="font-display text-2xl">Payout</h2>
            <p className="mt-3 text-sm text-muted">Pending expected</p>
            <p className="font-display text-3xl">{inr(expected._sum.expectedPayout?.toString())}</p>
            <p className="mt-3 text-sm text-muted">Net received</p>
            <p className="font-display text-3xl">{inr(received._sum.netReceived?.toString())}</p>
          </Panel>
        ) : null}
        <Panel>
          <h2 className="font-display text-2xl">Documents pending</h2>
          <p className="mt-3 font-display text-4xl">{pendingDocs}</p>
          <p className="text-sm text-muted">Pending or rejected files on visible cases</p>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Due follow-ups</h2>
          {tasks.length === 0 ? <p className="text-sm text-muted">Nothing due through today.</p> : null}
          <ul className="space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex justify-between gap-3">
                <span>
                  {task.type}
                  {task.lead ? ` · ${task.lead.customer.name}` : ""}
                  {task.dueAt < now ? " · overdue" : ""}
                </span>
                <span className="text-muted">{when(task.dueAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
