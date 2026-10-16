"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { parseAmount } from "@/lib/format";
import { savePayoutRecord } from "@/lib/payouts";
import { PAYOUT_STATUSES } from "@/lib/constants";

export async function savePayout(formData: FormData) {
  const user = await requireAction("payouts.write");
  if (!user) return;
  const status = String(formData.get("status") || "Expected");
  if (!(PAYOUT_STATUSES as readonly string[]).includes(status)) return;
  const loanCaseId = String(formData.get("loanCaseId") || "");
  const dateRaw = String(formData.get("payoutDate") || "");
  await savePayoutRecord(user, {
    id: String(formData.get("payoutId") || "") || null,
    loanCaseId,
    partnerKind: String(formData.get("partnerKind") || "Lender"),
    partnerName: String(formData.get("partnerName") || "").trim(),
    transactionAmount: parseAmount(formData.get("transactionAmount")),
    expectedPayout: parseAmount(formData.get("expectedPayout")),
    actualPayout: parseAmount(formData.get("actualPayout")),
    invoiceNo: String(formData.get("invoiceNo") || "") || null,
    deductions: parseAmount(formData.get("deductions")) ?? 0,
    payoutDate: dateRaw ? new Date(dateRaw) : null,
    status,
    notes: String(formData.get("notes") || "") || null,
  });
  revalidatePath("/payouts");
  revalidatePath(`/loans/${loanCaseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
