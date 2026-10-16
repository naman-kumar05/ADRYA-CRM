import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/scope";
import { inr, priorityTone, when } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { Badge, Empty, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { bulkAssign } from "@/actions/leads";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; source?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 20;
  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (sp.status) where.status = sp.status;
  if (sp.priority === "HOT" || sp.priority === "WARM" || sp.priority === "COLD") where.priority = sp.priority;
  if (sp.source) where.source = sp.source;
  if (sp.q) {
    where.OR = [
      { code: { contains: sp.q, mode: "insensitive" } },
      { productName: { contains: sp.q, mode: "insensitive" } },
      { city: { contains: sp.q, mode: "insensitive" } },
      { customer: { name: { contains: sp.q, mode: "insensitive" } } },
      { customer: { mobile: { contains: sp.q } } },
    ];
  }

  const [total, leads, statuses, sources, assignees] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: { customer: true, assignedTo: true, dealer: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.findMany({ where: leadScope(user), distinct: ["status"], select: { status: true } }),
    prisma.lead.findMany({ where: leadScope(user), distinct: ["source"], select: { source: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        description="Every inquiry gets an ADY id. Duplicate mobiles stay on the same customer."
        action={
          can(user.role, "leads.write") ? (
            <Link href="/leads/new" className="rounded-xl bg-field px-4 py-2 text-sm font-semibold text-white">
              New lead
            </Link>
          ) : null
        }
      />
      <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Search" className={fieldClass} />
        <select name="status" defaultValue={sp.status || ""} className={fieldClass}>
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item.status}>{item.status}</option>
          ))}
        </select>
        <select name="priority" defaultValue={sp.priority || ""} className={fieldClass}>
          <option value="">All priorities</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
        <select name="source" defaultValue={sp.source || ""} className={fieldClass}>
          <option value="">All sources</option>
          {sources.map((item) => (
            <option key={item.source}>{item.source}</option>
          ))}
        </select>
        <button className="rounded-xl border border-line bg-card px-4 py-2 text-sm md:col-span-4 md:w-fit">Apply filters</button>
      </form>
      {leads.length === 0 ? (
        <Empty title="No leads in this view" body="Create a lead or clear the filters. Dealers and executives only see records assigned to them." />
      ) : (
        <form action={bulkAssign}>
          <div className="space-y-3 md:hidden">
            {leads.map((lead) => (
              <Panel key={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/leads/${lead.id}`} className="text-base font-semibold text-field">
                      {lead.customer.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {lead.code} · {lead.productName}
                    </p>
                  </div>
                  {can(user.role, "leads.assign") ? (
                    <input type="checkbox" name="ids" value={lead.id} aria-label={`Select ${lead.code}`} className="mt-1 h-5 w-5" />
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge>{lead.pipelineStage}</Badge>
                  <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <a href={telHref(lead.customer.mobile)} className="inline-flex min-h-11 items-center font-semibold text-field">
                    {lead.customer.mobile}
                  </a>
                  <span>{inr(lead.loanAmount?.toString() || lead.budget?.toString())}</span>
                </div>
              </Panel>
            ))}
          </div>
          <Panel className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  {can(user.role, "leads.assign") ? <th className="px-3 py-3" /> : null}
                  <th className="px-3 py-3">Lead</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/80 last:border-0">
                    {can(user.role, "leads.assign") ? (
                      <td className="px-3 py-3">
                        <input type="checkbox" name="ids" value={lead.id} aria-label={`Select ${lead.code}`} />
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-semibold text-field">
                        {lead.code}
                      </Link>
                      <div className="text-xs text-muted">{when(lead.createdAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{lead.customer.name}</div>
                      <div className="text-xs text-muted">
                        <a href={telHref(lead.customer.mobile)} className="font-semibold text-field">
                          {lead.customer.mobile}
                        </a>{" "}
                        · {lead.city}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{lead.productName}</div>
                      <div className="text-xs text-muted">
                        {lead.source}
                        {lead.dealer ? ` · ${lead.dealer.companyName}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge>{lead.status}</Badge>
                        <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3">{lead.assignedTo?.name || "Unassigned"}</td>
                    <td className="px-3 py-3">{inr(lead.loanAmount?.toString() || lead.budget?.toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {can(user.role, "leads.assign") ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select name="assigneeId" className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Assign selected to
                </option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <SubmitButton label="Assign" />
            </div>
          ) : null}
        </form>
      )}
      <p className="mt-3 text-sm text-muted">
        Showing {(page - 1) * pageSize + (leads.length ? 1 : 0)}–{(page - 1) * pageSize + leads.length} of {total}
        {page > 1 ? (
          <>
            {" "}
            · <Link href={`/leads?page=${page - 1}`}>Previous</Link>
          </>
        ) : null}
        {page < pages ? (
          <>
            {" "}
            · <Link href={`/leads?page=${page + 1}`}>Next</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
