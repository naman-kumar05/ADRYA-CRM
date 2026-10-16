import { DOCUMENT_TYPES } from "./constants";
import { prisma } from "./db";
import { nextCode } from "./ids";
import { writeAudit } from "./audit";
import type { CurrentUser } from "./auth";
import { can } from "./rbac";
import { leadScope, loanScope } from "./scope";
import { partnerFits } from "./match";
import { num } from "./format";

export async function createLoanCaseRecord(
  actor: CurrentUser,
  input: {
    leadId: string;
    lenderId?: string | null;
    executiveId?: string | null;
    loanType: string;
    loanAmount: number;
    remarks?: string;
  },
) {
  if (!can(actor.role, "loans.create")) return { ok: false as const, error: "You cannot open a finance case." };

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, ...leadScope(actor) },
    include: { customer: true },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (!lead.loanRequired && input.loanAmount <= 0) {
    return { ok: false as const, error: "Enter a loan amount before opening a finance case." };
  }

  if (input.lenderId) {
    const lender = await prisma.financePartner.findUnique({ where: { id: input.lenderId } });
    if (!lender) return { ok: false as const, error: "Finance partner not found." };
    const fits = partnerFits(
      {
        status: lender.status,
        products: lender.products,
        states: lender.states,
        amountMin: num(lender.amountMin) ?? 0,
        amountMax: num(lender.amountMax) ?? 0,
      },
      {
        category: lead.category,
        productName: lead.productName,
        state: lead.state,
        loanAmount: input.loanAmount,
      },
    );
    if (!fits) {
      return { ok: false as const, error: "That partner is outside the configured product, location, or amount range." };
    }
  }

  const loan = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, "loan", "ADY-LN", 5);
    const created = await tx.loanCase.create({
      data: {
        code,
        leadId: lead.id,
        customerId: lead.customerId,
        requirementId: lead.requirementId,
        productName: lead.productName,
        loanType: input.loanType,
        loanAmount: input.loanAmount,
        lenderId: input.lenderId || null,
        dealerId: lead.dealerId,
        executiveId: input.executiveId || null,
        status: "New",
        remarks: input.remarks || null,
      },
    });
    await tx.document.createMany({
      data: DOCUMENT_TYPES.map((docType) => ({
        loanCaseId: created.id,
        leadId: lead.id,
        docType,
        status: "Pending",
      })),
    });
    await tx.statusEvent.create({
      data: { loanCaseId: created.id, fromStatus: null, toStatus: "New", userId: actor.id, note: "Case opened" },
    });
    await writeAudit(tx, {
      userId: actor.id,
      entity: "loan",
      entityId: created.id,
      action: "loan.create",
      changes: [{ field: "status", oldValue: null, newValue: "New" }],
    });
    return created;
  });

  return { ok: true as const, id: loan.id, code: loan.code };
}

export async function updateLoanCaseRecord(
  actor: CurrentUser,
  loanId: string,
  input: {
    status: string;
    note?: string;
    applicationNumber?: string | null;
    executiveId?: string | null;
    lenderId?: string | null;
    sanctionAmount?: number | null;
    sanctionDate?: Date | null;
    disbursementAmount?: number | null;
    disbursementDate?: Date | null;
    queryNote?: string | null;
    loginDate?: Date | null;
  },
) {
  if (!can(actor.role, "loans.update")) return { ok: false as const, error: "You cannot update finance cases." };
  const current = await prisma.loanCase.findFirst({ where: { id: loanId, ...loanScope(actor) } });
  if (!current) return { ok: false as const, error: "Loan case not found." };

  const sanctionDate =
    input.sanctionDate ?? (input.status === "Sanction" && !current.sanctionDate ? new Date() : current.sanctionDate);
  const disbursementDate =
    input.disbursementDate ??
    (["Disbursement", "Payout Pending", "Payout Received", "Closed"].includes(input.status) && !current.disbursementDate
      ? new Date()
      : current.disbursementDate);
  const loginDate = input.loginDate ?? (input.status === "Login" && !current.loginDate ? new Date() : current.loginDate);

  await prisma.$transaction(async (tx) => {
    await tx.loanCase.update({
      where: { id: current.id },
      data: {
        status: input.status,
        remarks: input.note ? input.note : current.remarks,
        applicationNumber: input.applicationNumber === undefined ? current.applicationNumber : input.applicationNumber,
        executiveId: input.executiveId === undefined ? current.executiveId : input.executiveId,
        lenderId: input.lenderId === undefined ? current.lenderId : input.lenderId,
        sanctionAmount: input.sanctionAmount === undefined ? current.sanctionAmount : input.sanctionAmount,
        sanctionDate,
        disbursementAmount:
          input.disbursementAmount === undefined ? current.disbursementAmount : input.disbursementAmount,
        disbursementDate,
        queryNote: input.queryNote === undefined ? current.queryNote : input.queryNote,
        loginDate,
      },
    });
    if (current.status !== input.status) {
      await tx.statusEvent.create({
        data: {
          loanCaseId: current.id,
          fromStatus: current.status,
          toStatus: input.status,
          note: input.note || null,
          userId: actor.id,
        },
      });
      await writeAudit(tx, {
        userId: actor.id,
        entity: "loan",
        entityId: current.id,
        action: "loan.status",
        changes: [{ field: "status", oldValue: current.status, newValue: input.status }],
      });
    }
  });

  return { ok: true as const };
}
