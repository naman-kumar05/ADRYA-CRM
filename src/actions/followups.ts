"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { followUpScope, leadScope } from "@/lib/scope";
import { FOLLOWUP_RESULTS, FOLLOWUP_TYPES } from "@/lib/constants";

export async function createFollowUp(formData: FormData) {
  const user = await requireAction("followups.write");
  if (!user) return;
  const leadId = String(formData.get("leadId") || "") || null;
  const loanCaseId = String(formData.get("loanCaseId") || "") || null;
  const type = String(formData.get("type") || "Call");
  const dueRaw = String(formData.get("dueAt") || "");
  if (!dueRaw || !(FOLLOWUP_TYPES as readonly string[]).includes(type)) return;
  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
    if (!lead) return;
  }
  const assigneeId = String(formData.get("assigneeId") || user.id);
  await prisma.followUp.create({
    data: {
      leadId,
      loanCaseId,
      assigneeId,
      type,
      dueAt: new Date(dueRaw),
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  if (leadId) {
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUp: new Date(dueRaw) } });
    revalidatePath(`/leads/${leadId}`);
  }
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}

export async function completeFollowUp(formData: FormData) {
  const user = await requireAction("followups.write");
  if (!user) return;
  const id = String(formData.get("id") || "");
  const result = String(formData.get("result") || "");
  if (!(FOLLOWUP_RESULTS as readonly string[]).includes(result)) return;
  const task = await prisma.followUp.findFirst({ where: { id, ...followUpScope(user) } });
  if (!task) return;
  await prisma.followUp.update({
    where: { id: task.id },
    data: {
      result,
      notes: String(formData.get("notes") || task.notes || ""),
      completedAt: new Date(),
    },
  });
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
}
