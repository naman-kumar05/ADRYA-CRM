import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { CurrentUser } from "./auth";
import { can } from "./rbac";
import { loanScope } from "./scope";

export function netPayout(actual: number | null, deductions: number) {
  if (actual === null) return null;
  return Math.round((actual - deductions) * 100) / 100;
}

export async function savePayoutRecord(
  actor: CurrentUser,
  input: {
    id?: string | null;
    loanCaseId: string;
    partnerKind: string;
    partnerName: string;
    transactionAmount: number | null;
    expectedPayout: number | null;
    actualPayout: number | null;
    invoiceNo?: string | null;
    deductions: number;
    payoutDate?: Date | null;
    status: string;
    notes?: string | null;
  },
) {
  if (!can(actor.role, "payouts.write")) return { ok: false as const, error: "You cannot record payouts." };
  const loan = await prisma.loanCase.findFirst({ where: { id: input.loanCaseId, ...loanScope(actor) } });
  if (!loan) return { ok: false as const, error: "Loan case not found." };
  if (input.expectedPayout === null && input.actualPayout === null) {
    return { ok: false as const, error: "Enter an expected or received amount. Payout rates are not hard-coded." };
  }
  if (input.id) {
    const existing = await prisma.payout.findFirst({ where: { id: input.id, loanCaseId: loan.id } });
    if (!existing) return { ok: false as const, error: "Payout not found on this case." };
  }

  const net = netPayout(input.actualPayout, input.deductions);
  const data = {
    loanCaseId: loan.id,
    partnerKind: input.partnerKind,
    partnerName: input.partnerName,
    transactionAmount: input.transactionAmount,
    expectedPayout: input.expectedPayout,
    actualPayout: input.actualPayout,
    invoiceNo: input.invoiceNo || null,
    deductions: input.deductions,
    netReceived: net,
    payoutDate: input.payoutDate,
    status: input.status,
    notes: input.notes || null,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const row = input.id
      ? await tx.payout.update({ where: { id: input.id }, data })
      : await tx.payout.create({ data });
    await writeAudit(tx, {
      userId: actor.id,
      entity: "payout",
      entityId: row.id,
      action: input.id ? "payout.update" : "payout.create",
      changes: [
        { field: "expectedPayout", newValue: input.expectedPayout?.toString() ?? null },
        { field: "actualPayout", newValue: input.actualPayout?.toString() ?? null },
        { field: "netReceived", newValue: net?.toString() ?? null },
        { field: "status", newValue: input.status },
      ],
    });
    return row;
  });

  return { ok: true as const, id: saved.id, net };
}
