import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { loanScope } from "@/lib/scope";
import { inr, when } from "@/lib/format";
import { LOAN_STATUSES, LENDER_DECISION_NOTE, PAYOUT_STATUSES } from "@/lib/constants";
import { Badge, NoAccess, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { DocumentForm } from "@/components/document-form";
import { updateLoanCase } from "@/actions/loans";
import { savePayout } from "@/actions/payouts";
import { loadFormOptions } from "@/lib/options";

export const metadata = { title: "Loan case" };

const STEPS = ["New", "Documents", "Login", "Processing", "Sanction", "Disbursement", "Payout", "Closed"];

function stepIndex(status: string) {
  if (status.startsWith("Document")) return 1;
  if (status === "Application Ready" || status === "Login") return 2;
  if (status === "Processing" || status.startsWith("Query")) return 3;
  if (status === "Sanction" || status === "Agreement") return 4;
  if (status === "Disbursement") return 5;
  if (status.startsWith("Payout")) return 6;
  if (status === "Closed") return 7;
  return 0;
}

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "loans.read")) return <NoAccess />;
  const { id } = await params;
  const loan = await prisma.loanCase.findFirst({
    where: { id, ...loanScope(user) },
    include: {
      customer: true,
      lender: true,
      dealer: true,
      executive: true,
      lead: true,
      documents: { orderBy: [{ docType: "asc" }, { version: "desc" }] },
      events: { orderBy: { createdAt: "asc" } },
      payouts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!loan) notFound();
  const options = await loadFormOptions();
  const partners = await prisma.financePartner.findMany({ where: { status: { in: ["Active", "Hold"] } }, orderBy: { name: "asc" } });
  const current = stepIndex(loan.status);
  const stopped = ["Rejected", "Cancelled", "Not Eligible", "Customer Not Interested"].includes(loan.status);

  return (
    <div>
      <PageHeader
        eyebrow={loan.code}
        title={loan.customer.name}
        description={`${loan.productName} · ${inr(loan.loanAmount.toString())} · ${loan.lender?.name || "Lender not chosen"}`}
        action={<Badge tone={stopped ? "bad" : "good"}>{loan.status}</Badge>}
      />
      <p className="mb-4 text-sm text-muted">{LENDER_DECISION_NOTE}</p>
      <ol className="mb-4 flex gap-2 overflow-x-auto text-xs">
        {STEPS.map((step, index) => (
          <li key={step} className={`rounded-full px-3 py-1 ${index <= current && !stopped ? "bg-field text-white" : "bg-card text-muted"}`}>
            {step}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Panel>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>Lead: {loan.lead ? <Link className="text-field" href={`/leads/${loan.lead.id}`}>{loan.lead.code}</Link> : "—"}</div>
              <div>Application: {loan.applicationNumber || "—"}</div>
              <div>Executive: {loan.executive?.name || "—"}</div>
              <div>Dealer: {loan.dealer?.companyName || "—"}</div>
              <div>Sanction: {inr(loan.sanctionAmount?.toString())} · {when(loan.sanctionDate, false)}</div>
              <div>Disbursement: {inr(loan.disbursementAmount?.toString())} · {when(loan.disbursementDate, false)}</div>
              <div className="sm:col-span-2">Query: {loan.queryNote || "None"}</div>
            </dl>
          </Panel>
          {can(user.role, "loans.update") ? (
            <Panel>
              <h2 className="mb-3 font-display text-2xl">Move the case</h2>
              <form action={updateLoanCase} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="loanId" value={loan.id} />
                <select name="status" defaultValue={loan.status} className={fieldClass}>
                  {LOAN_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <input name="applicationNumber" defaultValue={loan.applicationNumber || ""} placeholder="Application number" className={fieldClass} />
                <select name="lenderId" defaultValue={loan.lenderId || ""} className={fieldClass}>
                  <option value="">No lender</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
                <select name="executiveId" defaultValue={loan.executiveId || ""} className={fieldClass}>
                  <option value="">No executive</option>
                  {options.executives.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <input name="sanctionAmount" defaultValue={loan.sanctionAmount?.toString() || ""} placeholder="Sanction amount" className={fieldClass} />
                <input type="date" name="sanctionDate" className={fieldClass} />
                <input name="disbursementAmount" defaultValue={loan.disbursementAmount?.toString() || ""} placeholder="Disbursement amount" className={fieldClass} />
                <input type="date" name="disbursementDate" className={fieldClass} />
                <input name="queryNote" defaultValue={loan.queryNote || ""} placeholder="Lender query" className={fieldClass} />
                <input name="note" placeholder="Why the status changed" className={fieldClass} />
                <SubmitButton label="Save case" />
              </form>
            </Panel>
          ) : null}
          <Panel>
            <h2 className="mb-3 font-display text-2xl">Documents</h2>
            <ul className="mb-4 space-y-2 text-sm">
              {loan.documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {doc.docType} · v{doc.version} · {doc.status}
                  </span>
                  {doc.storageKey ? (
                    <a className="text-field" href={`/api/documents/${doc.id}`}>
                      {doc.fileName || "Download"}
                    </a>
                  ) : (
                    <span className="text-muted">No file</span>
                  )}
                </li>
              ))}
            </ul>
            {can(user.role, "documents.write") ? <DocumentForm loanCaseId={loan.id} /> : null}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-display text-2xl">Status timeline</h2>
            <ol className="space-y-3 text-sm">
              {loan.events.map((event) => (
                <li key={event.id}>
                  <p className="font-medium">{event.fromStatus || "Start"} → {event.toStatus}</p>
                  <p className="text-muted">{when(event.createdAt)}{event.note ? ` · ${event.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Panel>
          {can(user.role, "payouts.read") ? (
            <Panel>
              <h2 className="mb-3 font-display text-2xl">Payout</h2>
              <ul className="mb-3 space-y-2 text-sm">
                {loan.payouts.map((payout) => (
                  <li key={payout.id}>
                    {payout.partnerName} · {payout.status} · expected {inr(payout.expectedPayout?.toString())} · net {inr(payout.netReceived?.toString())}
                  </li>
                ))}
              </ul>
              {can(user.role, "payouts.write") ? (
                <form action={savePayout} className="grid gap-2">
                  <input type="hidden" name="loanCaseId" value={loan.id} />
                  <input name="partnerName" defaultValue={loan.lender?.name || ""} placeholder="Partner name" className={fieldClass} required />
                  <select name="partnerKind" className={fieldClass}>
                    <option>Lender</option>
                    <option>Dealer</option>
                    <option>Vendor</option>
                  </select>
                  <input name="transactionAmount" placeholder="Transaction amount" className={fieldClass} />
                  <input name="expectedPayout" placeholder="Expected payout from contract" className={fieldClass} />
                  <input name="actualPayout" placeholder="Actual received" className={fieldClass} />
                  <input name="deductions" placeholder="Deductions" className={fieldClass} />
                  <input name="invoiceNo" placeholder="Invoice number" className={fieldClass} />
                  <input type="date" name="payoutDate" className={fieldClass} />
                  <select name="status" className={fieldClass} defaultValue="Expected">
                    {PAYOUT_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <SubmitButton label="Record payout" />
                </form>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
