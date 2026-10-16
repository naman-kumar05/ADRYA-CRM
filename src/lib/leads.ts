import type { Priority } from "@prisma/client";
import { prisma } from "./db";
import { nextCode } from "./ids";
import { writeAudit } from "./audit";
import type { CurrentUser } from "./auth";
import { can } from "./rbac";
import { leadScope } from "./scope";
import { DSA_CHECKLIST } from "./constants";

export type LeadInput = {
  name: string;
  mobile: string;
  altMobile?: string;
  email?: string;
  occupation?: string;
  address?: string;
  state: string;
  district: string;
  city: string;
  pincode?: string;
  source: string;
  category: string;
  productName: string;
  requirementText?: string;
  budget: number | null;
  loanRequired: boolean;
  loanAmount: number | null;
  assignedToId?: string | null;
  priority: Priority;
  nextFollowUp?: Date | null;
  remarks?: string;
  customerId?: string | null;
  duplicateChoice?: "requirement" | "lead" | "";
  dealerId?: string | null;
  vendorId?: string | null;
};

export type DuplicateCustomer = {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  leads: { code: string; productName: string; status: string }[];
};

async function findByMobile(mobile: string) {
  return prisma.customer.findFirst({
    where: { OR: [{ mobile }, { altMobile: mobile }] },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { code: true, productName: true, status: true },
      },
    },
  });
}

export async function lookupCustomerByMobile(mobile: string): Promise<DuplicateCustomer | null> {
  const found = await findByMobile(mobile);
  if (!found) return null;
  return {
    id: found.id,
    code: found.code,
    name: found.name,
    city: found.city,
    state: found.state,
    leads: found.leads,
  };
}

export async function createLeadRecord(actor: CurrentUser, input: LeadInput) {
  if (!can(actor.role, "leads.write")) {
    return { ok: false as const, error: "You do not have permission to create leads." };
  }

  if (!input.customerId && !input.duplicateChoice) {
    const existing = await findByMobile(input.mobile);
    if (existing) {
      return {
        ok: false as const,
        error: "This mobile already belongs to a customer. Choose how to continue.",
        duplicate: {
          id: existing.id,
          code: existing.code,
          name: existing.name,
          city: existing.city,
          state: existing.state,
          leads: existing.leads,
        } satisfies DuplicateCustomer,
      };
    }
  }

  const assignee = can(actor.role, "leads.assign")
    ? input.assignedToId || actor.id
    : actor.id;

  const lead = await prisma.$transaction(async (tx) => {
    let customerId = input.customerId || null;
    if (customerId) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error("Customer not found");
    } else {
      const existing = await tx.customer.findFirst({
        where: { OR: [{ mobile: input.mobile }, { altMobile: input.mobile }] },
      });
      if (existing) customerId = existing.id;
    }

    if (!customerId) {
      const code = await nextCode(tx, "customer", "ADY-CU", 6);
      const created = await tx.customer.create({
        data: {
          code,
          name: input.name,
          mobile: input.mobile,
          altMobile: input.altMobile || null,
          email: input.email || null,
          occupation: input.occupation || null,
          address: input.address || null,
          state: input.state,
          district: input.district,
          city: input.city,
          pincode: input.pincode || null,
        },
      });
      customerId = created.id;
    }

    const requirementCode = await nextCode(tx, "requirement", "ADY-RQ", 6);
    const requirement = await tx.requirement.create({
      data: {
        code: requirementCode,
        customerId,
        category: input.category,
        productName: input.productName,
        details: input.requirementText || null,
        budget: input.budget,
        loanRequired: input.loanRequired,
        loanAmount: input.loanAmount,
        status: "Open",
      },
    });

    const code = await nextCode(tx, "lead", "ADY", 6);
    const createdLead = await tx.lead.create({
      data: {
        code,
        customerId,
        requirementId: requirement.id,
        source: input.source,
        category: input.category,
        productName: input.productName,
        requirementText: input.requirementText || null,
        budget: input.budget,
        loanRequired: input.loanRequired,
        loanAmount: input.loanAmount,
        assignedToId: assignee,
        createdById: actor.id,
        dealerId: input.dealerId || null,
        vendorId: input.vendorId || null,
        priority: input.priority,
        status: "New",
        pipelineStage: "Lead Inbound",
        stageUpdatedAt: new Date(),
        dealerStatus: input.dealerId ? "Pending" : "Pending",
        nextFollowUp: input.nextFollowUp || null,
        remarks: input.remarks || null,
        state: input.state,
        district: input.district,
        city: input.city,
        pincode: input.pincode || null,
      },
    });

    await tx.document.createMany({
      data: DSA_CHECKLIST.map((docType) => ({
        leadId: createdLead.id,
        docType,
        status: "Pending",
      })),
    });

    await writeAudit(tx, {
      userId: actor.id,
      entity: "lead",
      entityId: createdLead.id,
      action: input.duplicateChoice ? `lead.create.${input.duplicateChoice}` : "lead.create",
      changes: [{ field: "status", oldValue: null, newValue: "New" }],
    });

    if (assignee !== actor.id) {
      await tx.notification.create({
        data: {
          userId: assignee,
          title: "New lead assigned",
          body: `${createdLead.code} · ${input.name} · ${input.productName}`,
          href: `/leads/${createdLead.id}`,
        },
      });
    }

    return createdLead;
  });

  return { ok: true as const, id: lead.id, code: lead.code };
}

export async function updateLeadRecord(
  actor: CurrentUser,
  leadId: string,
  input: {
    status?: string;
    priority?: Priority;
    assignedToId?: string | null;
    dealerId?: string | null;
    vendorId?: string | null;
    nextFollowUp?: Date | null;
    remarks?: string | null;
    loanRequired?: boolean;
    loanAmount?: number | null;
    requirementText?: string | null;
  },
) {
  if (!can(actor.role, "leads.write")) return { ok: false as const, error: "You cannot edit leads." };
  const current = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(actor) } });
  if (!current) return { ok: false as const, error: "Lead not found." };

  const data: {
    status?: string;
    priority?: Priority;
    assignedToId?: string | null;
    dealerId?: string | null;
    vendorId?: string | null;
    nextFollowUp?: Date | null;
    remarks?: string | null;
    loanRequired?: boolean;
    loanAmount?: number | null;
    requirementText?: string | null;
  } = { ...input };

  if (!can(actor.role, "leads.assign")) delete data.assignedToId;

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const track = (field: string, oldValue: string | null, newValue: string | null) => {
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  };
  if (data.status) track("status", current.status, data.status);
  if (data.priority) track("priority", current.priority, data.priority);
  if (data.assignedToId !== undefined) track("assignedTo", current.assignedToId, data.assignedToId);
  if (data.dealerId !== undefined) track("dealer", current.dealerId, data.dealerId);
  if (data.vendorId !== undefined) track("vendor", current.vendorId, data.vendorId);
  if (data.loanAmount !== undefined) track("loanAmount", current.loanAmount?.toString() ?? null, data.loanAmount?.toString() ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: current.id }, data });
    if (changes.length) {
      await writeAudit(tx, { userId: actor.id, entity: "lead", entityId: current.id, action: "lead.update", changes });
    }
    if (data.assignedToId && data.assignedToId !== current.assignedToId) {
      await tx.notification.create({
        data: {
          userId: data.assignedToId,
          title: "Lead assigned to you",
          body: current.code,
          href: `/leads/${current.id}`,
        },
      });
    }
  });

  return { ok: true as const };
}

export async function setDealerStatusRecord(actor: CurrentUser, leadId: string, dealerStatus: string) {
  if (!can(actor.role, "dealer.status")) return { ok: false as const, error: "You cannot update dealer status." };
  const current = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(actor) },
    include: { dealer: true },
  });
  if (!current) return { ok: false as const, error: "Lead not found." };

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: current.id }, data: { dealerStatus } });
    await writeAudit(tx, {
      userId: actor.id,
      entity: "lead",
      entityId: current.id,
      action: "lead.dealerStatus",
      changes: [{ field: "dealerStatus", oldValue: current.dealerStatus, newValue: dealerStatus }],
    });
    if (current.assignedToId && current.assignedToId !== actor.id) {
      await tx.notification.create({
        data: {
          userId: current.assignedToId,
          title: `Dealer ${dealerStatus.toLowerCase()} a lead`,
          body: `${current.code}${current.dealer ? ` · ${current.dealer.companyName}` : ""}`,
          href: `/leads/${current.id}`,
        },
      });
    }
  });
  return { ok: true as const };
}

export async function bulkAssignRecord(actor: CurrentUser, ids: string[], assignedToId: string) {
  if (!can(actor.role, "leads.assign")) return { ok: false as const, error: "You cannot assign leads." };
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, ...leadScope(actor) },
    select: { id: true, code: true, assignedToId: true },
  });
  if (!leads.length) return { ok: false as const, error: "No matching leads to assign." };

  await prisma.$transaction(async (tx) => {
    for (const lead of leads) {
      await tx.lead.update({ where: { id: lead.id }, data: { assignedToId } });
      await writeAudit(tx, {
        userId: actor.id,
        entity: "lead",
        entityId: lead.id,
        action: "lead.assign",
        changes: [{ field: "assignedTo", oldValue: lead.assignedToId, newValue: assignedToId }],
      });
    }
    await tx.notification.create({
      data: {
        userId: assignedToId,
        title: "Leads assigned",
        body: `${leads.length} lead${leads.length === 1 ? "" : "s"} assigned to you`,
        href: "/leads",
      },
    });
  });
  return { ok: true as const, count: leads.length };
}
