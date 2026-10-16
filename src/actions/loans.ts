"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { parseAmount } from "@/lib/format";
import { createLoanCaseRecord, updateLoanCaseRecord } from "@/lib/loans";
import { LOAN_STATUSES } from "@/lib/constants";

function dateOrNull(value: FormDataEntryValue | null) {
  const raw = String(value || "");
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createLoanCase(formData: FormData) {
  const user = await requireAction("loans.create");
  if (!user) return;
  const leadId = String(formData.get("leadId") || "");
  const amount = parseAmount(formData.get("loanAmount"));
  if (!amount) return;
  const result = await createLoanCaseRecord(user, {
    leadId,
    lenderId: String(formData.get("lenderId") || "") || null,
    executiveId: String(formData.get("executiveId") || "") || null,
    loanType: String(formData.get("loanType") || "New"),
    loanAmount: amount,
    remarks: String(formData.get("remarks") || "").trim() || undefined,
  });
  if (!result.ok) return;
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/loans");
  revalidatePath("/dashboard");
  redirect(`/loans/${result.id}`);
}

export async function updateLoanCase(formData: FormData) {
  const user = await requireAction("loans.update");
  if (!user) return;
  const loanId = String(formData.get("loanId") || "");
  const status = String(formData.get("status") || "");
  if (!(LOAN_STATUSES as readonly string[]).includes(status)) return;
  await updateLoanCaseRecord(user, loanId, {
    status,
    note: String(formData.get("note") || "").trim() || undefined,
    applicationNumber: String(formData.get("applicationNumber") || "") || null,
    executiveId: String(formData.get("executiveId") || "") || null,
    lenderId: String(formData.get("lenderId") || "") || null,
    sanctionAmount: parseAmount(formData.get("sanctionAmount")),
    sanctionDate: dateOrNull(formData.get("sanctionDate")),
    disbursementAmount: parseAmount(formData.get("disbursementAmount")),
    disbursementDate: dateOrNull(formData.get("disbursementDate")),
    queryNote: String(formData.get("queryNote") || "") || null,
    loginDate: dateOrNull(formData.get("loginDate")),
  });
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
