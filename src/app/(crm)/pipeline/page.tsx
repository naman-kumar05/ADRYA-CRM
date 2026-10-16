import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/scope";
import { DSA_PIPELINE, FOLLOWUP_RESULTS, WHATSAPP_TEMPLATES } from "@/lib/constants";
import { inr } from "@/lib/format";
import { fillTemplate, telHref, whatsAppHref } from "@/lib/phone";
import { ensureLeadChecklist, ensureStaleReminders, missingRequiredDocs, staleCutoff } from "@/lib/pipeline";
import { PageHeader } from "@/components/ui";
import { moveStage, logInteraction } from "@/actions/pipeline";
import { WhatsAppButton } from "@/components/whatsapp-button";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  if (can(user.role, "followups.write")) await ensureStaleReminders(user);

  const leads = await prisma.lead.findMany({
    where: leadScope(user),
    include: {
      customer: true,
      documents: { where: { loanCaseId: null }, select: { docType: true, status: true } },
    },
    orderBy: { stageUpdatedAt: "asc" },
    take: 200,
  });
  await Promise.all(leads.filter((lead) => lead.documents.length < 4).map((lead) => ensureLeadChecklist(lead.id)));
  const refreshed =
    leads.some((lead) => lead.documents.length < 4)
      ? await prisma.lead.findMany({
          where: { id: { in: leads.map((lead) => lead.id) } },
          include: {
            customer: true,
            documents: { where: { loanCaseId: null }, select: { docType: true, status: true } },
          },
          orderBy: { stageUpdatedAt: "asc" },
        })
      : leads;

  const cutoff = staleCutoff();

  return (
    <div>
      <PageHeader
        eyebrow="DSA file board"
        title="Pipeline"
        description="Move a file from the first call to documents, the aggregator login, bank verification, and disbursement. Call and WhatsApp stay on the card."
      />
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-hot">{error}</p> : null}
      <nav className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {DSA_PIPELINE.map((stage) => (
          <a key={stage} href={`#stage-${stage.replace(/\s+/g, "-").toLowerCase()}`} className="shrink-0 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold">
            {stage}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto lg:pb-4">
        {DSA_PIPELINE.map((stage) => {
          const column = refreshed.filter((lead) => lead.pipelineStage === stage);
          return (
            <section id={`stage-${stage.replace(/\s+/g, "-").toLowerCase()}`} key={stage} className="w-full scroll-mt-28 rounded-2xl border border-line bg-card p-3 lg:w-80 lg:shrink-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{stage}</h2>
                <span className="rounded-full bg-field-2 px-2 py-0.5 text-xs font-semibold text-field-dark">{column.length}</span>
              </div>
              <div className="space-y-3">
                {column.map((lead) => {
                  const missing = missingRequiredDocs(lead.documents);
                  const stale = lead.pipelineStage !== "Disbursed" && lead.stageUpdatedAt < cutoff && !["Not Interested", "Closed"].includes(lead.status);
                  const messageValues = {
                    name: lead.customer.name.split(" ")[0],
                    product: lead.productName,
                    code: lead.code,
                    stage: lead.pipelineStage,
                    missing: missing.join(", "),
                  };
                  return (
                    <article key={lead.id} className={`rounded-xl border p-3 ${stale ? "border-hot bg-red-50" : "border-line bg-paper"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/leads/${lead.id}`} className="font-semibold text-field">
                            {lead.customer.name}
                          </Link>
                          <p className="text-xs text-muted">
                            {lead.productName} · {inr(lead.loanAmount?.toString() || lead.budget?.toString())}
                          </p>
                        </div>
                        {stale ? <span className="text-[11px] font-semibold text-hot">48h quiet</span> : null}
                      </div>
                      <p className="mt-2 text-xs text-muted">{missing.length ? `Missing: ${missing.join(", ")}` : "PAN, Aadhaar and bank statement are in"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={telHref(lead.customer.mobile)} className="inline-flex min-h-11 items-center rounded-lg bg-field px-3 text-sm font-semibold text-white">
                          Call
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
                      {can(user.role, "followups.write") ? (
                        <form action={logInteraction} className="mt-2 flex gap-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <input type="hidden" name="type" value="Call" />
                          <select name="result" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs">
                            {FOLLOWUP_RESULTS.map((result) => (
                              <option key={result}>{result}</option>
                            ))}
                          </select>
                          <button className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold">Log call</button>
                        </form>
                      ) : null}
                      {can(user.role, "leads.write") ? (
                        <form action={moveStage} className="mt-2 flex gap-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <input type="hidden" name="returnTo" value="/pipeline" />
                          <select name="pipelineStage" defaultValue={lead.pipelineStage} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs">
                            {DSA_PIPELINE.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                          <button className="rounded-lg bg-ink px-2 py-1.5 text-xs font-semibold text-white">Move</button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
