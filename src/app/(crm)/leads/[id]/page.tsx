import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/scope";
import { inr, num, priorityTone, toDateTimeLocal, when } from "@/lib/format";
import { partnerFits } from "@/lib/match";
import { DEALER_LEAD_STATUSES, DOCUMENT_STATUSES, DSA_PIPELINE, FOLLOWUP_TYPES, LEAD_STATUSES, LENDER_DECISION_NOTE, WHATSAPP_TEMPLATES } from "@/lib/constants";
import { fillTemplate, telHref, whatsAppHref } from "@/lib/phone";
import { ensureLeadChecklist, missingRequiredDocs, staleCutoff } from "@/lib/pipeline";
import { Badge, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { setDealerStatus, updateLead } from "@/actions/leads";
import { moveStage } from "@/actions/pipeline";
import { saveChecklistDocument } from "@/actions/documents";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { createFollowUp } from "@/actions/followups";
import { createLoanCase } from "@/actions/loans";
import { loadFormOptions } from "@/lib/options";

export const metadata = { title: "Lead" };

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(user) },
    include: {
      customer: true,
      assignedTo: true,
      dealer: true,
      vendor: true,
      requirement: true,
      documents: { where: { loanCaseId: null }, orderBy: { docType: "asc" } },
      loanCases: { include: { lender: true }, orderBy: { createdAt: "desc" } },
      followUps: { include: { assignee: true }, orderBy: { dueAt: "desc" } },
    },
  });
  if (!lead) notFound();
  await ensureLeadChecklist(lead.id);
  const checklist =
    lead.documents.length >= 4
      ? lead.documents
      : await prisma.document.findMany({ where: { leadId: lead.id, loanCaseId: null }, orderBy: { docType: "asc" } });

  const [options, partners, audits] = await Promise.all([
    loadFormOptions(),
    prisma.financePartner.findMany({ where: { status: "Active" }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { entity: "lead", entityId: lead.id }, orderBy: { createdAt: "desc" }, take: 12, include: { user: true } }),
  ]);
  const amount = num(lead.loanAmount);
  const matches = partners.filter((partner) =>
    partnerFits(
      {
        status: partner.status,
        products: partner.products,
        states: partner.states,
        amountMin: num(partner.amountMin) ?? 0,
        amountMax: num(partner.amountMax) ?? 0,
      },
      { category: lead.category, productName: lead.productName, state: lead.state, loanAmount: amount },
    ),
  );
  const statuses = await prisma.statusOption.findMany({ where: { entity: "lead", active: true }, orderBy: { sort: "asc" } });
  const statusNames = statuses.length ? statuses.map((status) => status.name) : [...LEAD_STATUSES];
  const missing = missingRequiredDocs(checklist);
  const stale = lead.pipelineStage !== "Disbursed" && lead.stageUpdatedAt < staleCutoff() && !["Not Interested", "Closed"].includes(lead.status);
  const messageValues = {
    name: lead.customer.name.split(" ")[0],
    product: lead.productName,
    code: lead.code,
    stage: lead.pipelineStage,
    missing: missing.join(", "),
  };

  return (
    <div>
      <PageHeader
        eyebrow={lead.code}
        title={lead.customer.name}
        description={`${lead.productName} · ${lead.city}, ${lead.state} · ${lead.pipelineStage}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
            <Badge tone="good">{lead.status}</Badge>
          </div>
        }
      />
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-hot">{error}</p> : null}
      {stale ? (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-hot">This file has not moved in 48 hours. Call the customer or check the aggregator portal.</p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a href={telHref(lead.customer.mobile)} className="inline-flex min-h-11 items-center rounded-xl bg-field px-4 text-sm font-semibold text-white">
          Call {lead.customer.mobile}
        </a>
        {WHATSAPP_TEMPLATES.map((template) => (
          <WhatsAppButton
            key={template.id}
            leadId={lead.id}
            label={template.label}
            href={whatsAppHref(lead.customer.mobile, fillTemplate(template.text, messageValues))}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <Panel>
            <h2 className="font-display text-2xl">File stage</h2>
            <p className="mt-1 text-sm text-muted">PAN, Aadhaar and bank statement have to be in before a file can move to PolicyBazaar.</p>
            {can(user.role, "leads.write") ? (
              <form action={moveStage} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="returnTo" value={`/leads/${lead.id}`} />
                <select name="pipelineStage" defaultValue={lead.pipelineStage} className={fieldClass}>
                  {DSA_PIPELINE.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
                <SubmitButton label="Move file" />
              </form>
            ) : (
              <p className="mt-2 text-sm">{lead.pipelineStage}</p>
            )}
          </Panel>
          <Panel>
            <h2 className="font-display text-2xl">Document checklist</h2>
            <p className="mt-1 text-sm text-muted">{missing.length ? `Still missing: ${missing.join(", ")}` : "Required papers are in."}</p>
            <ul className="mt-3 space-y-3">
              {checklist.map((doc) => (
                <li key={doc.id} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">{doc.docType}</span>
                    <Badge tone={doc.status === "Pending" || doc.status === "Rejected" ? "bad" : "good"}>{doc.status}</Badge>
                  </div>
                  {doc.storageKey ? (
                    <a className="text-xs text-field" href={`/api/documents/${doc.id}`}>
                      {doc.fileName || "Download"}
                    </a>
                  ) : null}
                  {can(user.role, "documents.write") ? (
                    <form action={saveChecklistDocument} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <select name="status" defaultValue={doc.status} className={fieldClass}>
                        {DOCUMENT_STATUSES.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={fieldClass} />
                      <SubmitButton label="Save" />
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h2 className="font-display text-2xl">Requirement</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Customer</dt>
                <dd>
                  <Link href={`/customers/${lead.customer.id}`} className="text-field">
                    {lead.customer.code}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Requirement</dt>
                <dd>{lead.requirement?.code || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Source</dt>
                <dd>{lead.source}</dd>
              </div>
              <div>
                <dt className="text-muted">Budget / loan</dt>
                <dd>
                  {inr(lead.budget?.toString())} / {lead.loanRequired ? inr(lead.loanAmount?.toString()) : "No loan"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Notes</dt>
                <dd>{lead.requirementText || "—"}</dd>
              </div>
            </dl>
          </Panel>

          {can(user.role, "leads.write") ? (
            <Panel>
              <h2 className="mb-3 font-display text-2xl">Update</h2>
              <form action={updateLead} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Status</span>
                  <select name="status" defaultValue={lead.status} className={fieldClass}>
                    {statusNames.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Priority</span>
                  <select name="priority" defaultValue={lead.priority} className={fieldClass}>
                    <option value="HOT">Hot</option>
                    <option value="WARM">Warm</option>
                    <option value="COLD">Cold</option>
                  </select>
                </label>
                {can(user.role, "leads.assign") ? (
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Executive</span>
                    <select name="assignedToId" defaultValue={lead.assignedToId || ""} className={fieldClass}>
                      <option value="">Unassigned</option>
                      {options.users.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Dealer</span>
                  <select name="dealerId" defaultValue={lead.dealerId || ""} className={fieldClass}>
                    <option value="">None</option>
                    {options.dealers.map((dealer) => (
                      <option key={dealer.id} value={dealer.id}>
                        {dealer.companyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Vendor</span>
                  <select name="vendorId" defaultValue={lead.vendorId || ""} className={fieldClass}>
                    <option value="">None</option>
                    {options.vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.companyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Next follow-up</span>
                  <input type="datetime-local" name="nextFollowUp" defaultValue={toDateTimeLocal(lead.nextFollowUp)} className={fieldClass} />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Remarks</span>
                  <textarea name="remarks" defaultValue={lead.remarks || ""} rows={2} className={fieldClass} />
                </label>
                <SubmitButton label="Save lead" />
              </form>
            </Panel>
          ) : null}

          {can(user.role, "dealer.status") ? (
            <Panel>
              <h2 className="font-display text-2xl">Dealer handoff</h2>
              <p className="mt-1 text-sm text-muted">
                {lead.dealer ? lead.dealer.companyName : "No dealer assigned"} · {lead.dealerStatus}
              </p>
              <form action={setDealerStatus} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <select name="dealerStatus" defaultValue={lead.dealerStatus} className={fieldClass}>
                  {DEALER_LEAD_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <SubmitButton label="Update dealer status" />
              </form>
            </Panel>
          ) : null}

          {can(user.role, "loans.create") && lead.loanRequired ? (
            <Panel>
              <h2 className="font-display text-2xl">Open finance case</h2>
              <p className="mt-1 text-sm text-muted">{LENDER_DECISION_NOTE}</p>
              {matches.length === 0 ? (
                <p className="mt-3 text-sm">No active partner matches this product, state and amount. Adjust the partner master or the loan amount.</p>
              ) : (
                <form action={createLoanCase} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Applicable partners</span>
                    <select name="lenderId" className={fieldClass} defaultValue={matches[0]?.id}>
                      {matches.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name} · {partner.partnerType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Loan type</span>
                    <input name="loanType" defaultValue="New" className={fieldClass} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Loan amount</span>
                    <input name="loanAmount" defaultValue={amount ?? ""} className={fieldClass} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Finance executive</span>
                    <select name="executiveId" className={fieldClass} defaultValue="">
                      <option value="">Assign later</option>
                      {options.executives.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton label="Create loan case" />
                </form>
              )}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="mb-3 font-display text-2xl">Finance cases</h2>
            {lead.loanCases.length === 0 ? <p className="text-sm text-muted">No case yet.</p> : null}
            <ul className="space-y-2 text-sm">
              {lead.loanCases.map((loan) => (
                <li key={loan.id}>
                  <Link href={`/loans/${loan.id}`} className="font-semibold text-field">
                    {loan.code}
                  </Link>{" "}
                  · {loan.status} · {loan.lender?.name || "Lender not selected"} · {inr(loan.loanAmount.toString())}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="font-display text-2xl">People</h2>
            <p className="mt-2 text-sm">Executive: {lead.assignedTo?.name || "Unassigned"}</p>
            <p className="text-sm">Dealer: {lead.dealer?.companyName || "—"}</p>
            <p className="text-sm">Vendor: {lead.vendor?.companyName || "—"}</p>
          </Panel>
          {can(user.role, "followups.write") ? (
            <Panel>
              <h2 className="mb-3 font-display text-2xl">Follow-up</h2>
              <form action={createFollowUp} className="space-y-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <select name="type" className={fieldClass}>
                  {FOLLOWUP_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input type="datetime-local" name="dueAt" required className={fieldClass} />
                <textarea name="notes" rows={2} placeholder="Notes" className={fieldClass} />
                <SubmitButton label="Schedule" />
              </form>
            </Panel>
          ) : null}
          <Panel>
            <h2 className="mb-3 font-display text-2xl">Timeline</h2>
            <ul className="space-y-3 text-sm">
              {lead.followUps.map((task) => (
                <li key={task.id}>
                  <p className="font-medium">
                    {task.type}
                    {task.completedAt ? ` · ${task.result}` : " · open"}
                  </p>
                  <p className="text-muted">
                    {when(task.dueAt)} · {task.assignee.name}
                  </p>
                </li>
              ))}
              {audits.map((event) => (
                <li key={event.id}>
                  <p className="font-medium">
                    {event.field || event.action}: {event.oldValue || "—"} → {event.newValue || "—"}
                  </p>
                  <p className="text-muted">
                    {when(event.createdAt)} · {event.user?.name || "System"}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
