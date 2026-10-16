"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/scope";
import { movePipelineStage } from "@/lib/pipeline";
import { FOLLOWUP_RESULTS } from "@/lib/constants";

function safeReturn(value: FormDataEntryValue | null) {
  const path = String(value || "/pipeline");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/pipeline";
}

export async function moveStage(formData: FormData) {
  const user = await requireAction("leads.write");
  const returnTo = safeReturn(formData.get("returnTo"));
  if (!user) redirect("/login");
  const result = await movePipelineStage(user, String(formData.get("leadId") || ""), String(formData.get("pipelineStage") || ""));
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  const leadId = String(formData.get("leadId") || "");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (!result.ok) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(result.error)}`);
  redirect(returnTo);
}

export async function logInteraction(formData: FormData) {
  const user = await requireAction("followups.write");
  if (!user) return;
  const leadId = String(formData.get("leadId") || "");
  const type = String(formData.get("type") || "Call");
  const result = String(formData.get("result") || "Connected");
  if (!(FOLLOWUP_RESULTS as readonly string[]).includes(result)) return;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) return;
  const note = String(formData.get("notes") || "").trim();
  await prisma.followUp.create({
    data: {
      leadId: lead.id,
      assigneeId: user.id,
      type: type === "WhatsApp" ? "WhatsApp" : "Call",
      dueAt: new Date(),
      completedAt: new Date(),
      result,
      notes: note || (type === "WhatsApp" ? "WhatsApp template sent" : "Call logged from the pipeline"),
    },
  });
  revalidatePath("/pipeline");
  revalidatePath("/follow-ups");
  revalidatePath(`/leads/${lead.id}`);
}

export async function logWhatsApp(leadId: string, templateLabel: string) {
  const user = await requireAction("followups.write");
  if (!user) return;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) } });
  if (!lead) return;
  await prisma.followUp.create({
    data: {
      leadId: lead.id,
      assigneeId: user.id,
      type: "WhatsApp",
      dueAt: new Date(),
      completedAt: new Date(),
      result: "Connected",
      notes: `WhatsApp template sent: ${templateLabel}`,
    },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/follow-ups");
}
