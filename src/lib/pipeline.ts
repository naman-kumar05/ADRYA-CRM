import { DISBURSEMENT_PLUS, DSA_CHECKLIST, DSA_PIPELINE, DSA_REQUIRED_DOCS, STALE_FILE_HOURS } from "./constants";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { CurrentUser } from "./auth";
import { can } from "./rbac";
import { leadScope } from "./scope";

const READY = new Set(["Uploaded", "Verified", "N/A"]);

export function isDocReady(status: string) {
  return READY.has(status);
}

export function missingRequiredDocs(documents: { docType: string; status: string }[]) {
  return DSA_REQUIRED_DOCS.filter((docType) => {
    const rows = documents.filter((doc) => doc.docType === docType);
    return rows.length === 0 || rows.every((row) => !isDocReady(row.status));
  });
}

export function inferPipelineStage(lead: { status: string; loanCases: { status: string }[] }) {
  const loanStatuses = lead.loanCases.map((loan) => loan.status);
  if (loanStatuses.some((status) => DISBURSEMENT_PLUS.has(status))) return "Disbursed";
  if (loanStatuses.some((status) => ["Sanction", "Agreement", "Processing", "Query Raised", "Query Resolved"].includes(status))) {
    return "Bank Verification";
  }
  if (loanStatuses.some((status) => ["Login", "Application Ready"].includes(status))) return "Submitted to PolicyBazaar";
  if (["Documents Pending", "Documents Received"].includes(lead.status)) return "Documents Collected";
  return "Lead Inbound";
}

const STATUS_FOR_STAGE: Record<string, string> = {
  "Lead Inbound": "New",
  "Documents Collected": "Documents Received",
  "Submitted to PolicyBazaar": "Interested",
  "Bank Verification": "Interested",
  Disbursed: "Closed",
};

export async function ensureLeadChecklist(leadId: string) {
  const existing = await prisma.document.findMany({
    where: { leadId, loanCaseId: null, docType: { in: [...DSA_CHECKLIST] } },
    select: { docType: true },
  });
  const have = new Set(existing.map((doc) => doc.docType));
  const missing = DSA_CHECKLIST.filter((docType) => !have.has(docType));
  if (!missing.length) return;
  await prisma.document.createMany({
    data: missing.map((docType) => ({ leadId, docType, status: "Pending" })),
  });
}

export async function movePipelineStage(actor: CurrentUser, leadId: string, pipelineStage: string) {
  if (!can(actor.role, "leads.write")) return { ok: false as const, error: "You cannot move files." };
  if (!(DSA_PIPELINE as readonly string[]).includes(pipelineStage)) {
    return { ok: false as const, error: "Unknown pipeline stage." };
  }
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(actor) },
    include: { documents: { where: { loanCaseId: null }, select: { docType: true, status: true } } },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (lead.pipelineStage === pipelineStage) return { ok: true as const };

  const nextIndex = DSA_PIPELINE.indexOf(pipelineStage as (typeof DSA_PIPELINE)[number]);
  const aggregatorIndex = DSA_PIPELINE.indexOf("Submitted to PolicyBazaar");
  if (nextIndex >= aggregatorIndex) {
    const missing = missingRequiredDocs(lead.documents);
    if (missing.length) {
      return { ok: false as const, error: `Still missing before the aggregator: ${missing.join(", ")}.` };
    }
  }

  const currentIndex = DSA_PIPELINE.indexOf(lead.pipelineStage as (typeof DSA_PIPELINE)[number]);
  const data: { pipelineStage: string; stageUpdatedAt: Date; status?: string } = {
    pipelineStage,
    stageUpdatedAt: new Date(),
  };
  if (nextIndex > currentIndex && STATUS_FOR_STAGE[pipelineStage]) data.status = STATUS_FOR_STAGE[pipelineStage];

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data });
    await writeAudit(tx, {
      userId: actor.id,
      entity: "lead",
      entityId: lead.id,
      action: "lead.pipeline",
      changes: [{ field: "pipelineStage", oldValue: lead.pipelineStage, newValue: pipelineStage }],
    });
  });
  return { ok: true as const };
}

export async function ensureStaleReminders(actor: CurrentUser) {
  if (!can(actor.role, "followups.write")) return 0;
  const cutoff = new Date(Date.now() - STALE_FILE_HOURS * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      ...leadScope(actor),
      stageUpdatedAt: { lt: cutoff },
      pipelineStage: { not: "Disbursed" },
      status: { notIn: ["Not Interested", "Closed"] },
    },
    select: { id: true, code: true, assignedToId: true },
  });
  let created = 0;
  for (const lead of leads) {
    const open = await prisma.followUp.findFirst({
      where: { leadId: lead.id, completedAt: null, notes: { startsWith: "[48h]" } },
      select: { id: true },
    });
    if (open) continue;
    await prisma.followUp.create({
      data: {
        leadId: lead.id,
        assigneeId: lead.assignedToId || actor.id,
        type: "Call",
        dueAt: new Date(),
        notes: `[48h] ${lead.code} has not moved in 48 hours. Call the customer or check the aggregator portal.`,
      },
    });
    created += 1;
  }
  return created;
}

export function staleCutoff() {
  return new Date(Date.now() - STALE_FILE_HOURS * 60 * 60 * 1000);
}
