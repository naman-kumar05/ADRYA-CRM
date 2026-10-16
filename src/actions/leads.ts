"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { parseAmount } from "@/lib/format";
import {
  bulkAssignRecord,
  createLeadRecord,
  lookupCustomerByMobile,
  setDealerStatusRecord,
  updateLeadRecord,
} from "@/lib/leads";
import { DEALER_LEAD_STATUSES } from "@/lib/constants";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer name"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  altMobile: z.string().regex(/^[6-9]\d{9}$/, "Alternate mobile is invalid").optional().or(z.literal("")),
  email: z.string().trim().email("Email is invalid").optional().or(z.literal("")),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits").optional().or(z.literal("")),
  state: z.string().trim().min(2, "Choose a state"),
  district: z.string().trim().min(2, "Choose a district"),
  city: z.string().trim().min(2, "Choose a city"),
  source: z.string().trim().min(2, "Choose a source"),
  category: z.string().trim().min(2, "Choose a category"),
  productName: z.string().trim().min(2, "Choose a product"),
  priority: z.enum(["HOT", "WARM", "COLD"]),
  duplicateChoice: z.enum(["requirement", "lead", ""]).optional(),
});

export async function lookupMobile(mobile: string) {
  const user = await requireAction("leads.write");
  if (!user) return null;
  if (!/^[6-9]\d{9}$/.test(mobile)) return null;
  return lookupCustomerByMobile(mobile);
}

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAction("leads.write");
  if (!user) return { error: "You do not have permission to create leads." };

  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    mobile: String(formData.get("mobile") || "").trim(),
    altMobile: String(formData.get("altMobile") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    pincode: String(formData.get("pincode") || "").trim(),
    state: formData.get("state"),
    district: formData.get("district"),
    city: formData.get("city"),
    source: formData.get("source"),
    category: formData.get("category"),
    productName: formData.get("productName"),
    priority: formData.get("priority") || "WARM",
    duplicateChoice: String(formData.get("duplicateChoice") || ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Check the form." };

  const nextFollowUpRaw = String(formData.get("nextFollowUp") || "");
  const result = await createLeadRecord(user, {
    ...parsed.data,
    altMobile: parsed.data.altMobile || undefined,
    email: parsed.data.email || undefined,
    pincode: parsed.data.pincode || undefined,
    occupation: String(formData.get("occupation") || "").trim() || undefined,
    address: String(formData.get("address") || "").trim() || undefined,
    requirementText: String(formData.get("requirementText") || "").trim() || undefined,
    budget: parseAmount(formData.get("budget")),
    loanRequired: formData.get("loanRequired") === "yes",
    loanAmount: parseAmount(formData.get("loanAmount")),
    assignedToId: String(formData.get("assignedToId") || "") || null,
    nextFollowUp: nextFollowUpRaw ? new Date(nextFollowUpRaw) : null,
    remarks: String(formData.get("remarks") || "").trim() || undefined,
    customerId: String(formData.get("customerId") || "") || null,
    duplicateChoice: parsed.data.duplicateChoice || "",
    dealerId: String(formData.get("dealerId") || "") || null,
    vendorId: String(formData.get("vendorId") || "") || null,
  });

  if (!result.ok) return { error: result.error, duplicate: "duplicate" in result ? result.duplicate : undefined };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  redirect(`/leads/${result.id}`);
}

export async function updateLead(formData: FormData) {
  const user = await requireAction("leads.write");
  if (!user) return;
  const leadId = String(formData.get("leadId") || "");
  const nextFollowUpRaw = String(formData.get("nextFollowUp") || "");
  await updateLeadRecord(user, leadId, {
    status: String(formData.get("status") || "") || undefined,
    priority: (String(formData.get("priority") || "") || undefined) as "HOT" | "WARM" | "COLD" | undefined,
    assignedToId: formData.has("assignedToId") ? String(formData.get("assignedToId") || "") || null : undefined,
    dealerId: formData.has("dealerId") ? String(formData.get("dealerId") || "") || null : undefined,
    vendorId: formData.has("vendorId") ? String(formData.get("vendorId") || "") || null : undefined,
    nextFollowUp: formData.has("nextFollowUp") ? (nextFollowUpRaw ? new Date(nextFollowUpRaw) : null) : undefined,
    remarks: formData.has("remarks") ? String(formData.get("remarks") || "") : undefined,
    loanRequired: formData.has("loanRequired") ? formData.get("loanRequired") === "yes" : undefined,
    loanAmount: formData.has("loanAmount") ? parseAmount(formData.get("loanAmount")) : undefined,
    requirementText: formData.has("requirementText") ? String(formData.get("requirementText") || "") : undefined,
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function setDealerStatus(formData: FormData) {
  const user = await requireAction("dealer.status");
  if (!user) return;
  const leadId = String(formData.get("leadId") || "");
  const dealerStatus = String(formData.get("dealerStatus") || "");
  if (!(DEALER_LEAD_STATUSES as readonly string[]).includes(dealerStatus)) return;
  await setDealerStatusRecord(user, leadId, dealerStatus);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function bulkAssign(formData: FormData) {
  const user = await requireAction("leads.assign");
  if (!user) return;
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const assignedToId = String(formData.get("assigneeId") || "");
  if (!ids.length || !assignedToId) return;
  await bulkAssignRecord(user, ids, assignedToId);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}
