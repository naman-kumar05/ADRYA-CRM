import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";

const none = { id: "__none__" };

export function leadScope(user: CurrentUser): Prisma.LeadWhereInput {
  if (user.role === "SALES_EXECUTIVE") return { assignedToId: user.id };
  if (user.role === "DEALER") return user.dealerId ? { dealerId: user.dealerId } : none;
  if (user.role === "VENDOR") return user.vendorId ? { vendorId: user.vendorId } : none;
  if (user.role === "FINANCE_EXECUTIVE") return { loanCases: { some: { executiveId: user.id } } };
  return {};
}

export function customerScope(user: CurrentUser): Prisma.CustomerWhereInput {
  if (user.role === "SALES_EXECUTIVE") return { leads: { some: { assignedToId: user.id } } };
  if (user.role === "DEALER") return user.dealerId ? { leads: { some: { dealerId: user.dealerId } } } : none;
  if (user.role === "VENDOR") return user.vendorId ? { leads: { some: { vendorId: user.vendorId } } } : none;
  if (user.role === "FINANCE_EXECUTIVE") return { loanCases: { some: { executiveId: user.id } } };
  return {};
}

export function loanScope(user: CurrentUser): Prisma.LoanCaseWhereInput {
  if (user.role === "SALES_EXECUTIVE") return { lead: { assignedToId: user.id } };
  if (user.role === "FINANCE_EXECUTIVE") return { executiveId: user.id };
  if (user.role === "DEALER") return user.dealerId ? { dealerId: user.dealerId } : none;
  if (user.role === "VENDOR") return none;
  return {};
}

export function followUpScope(user: CurrentUser): Prisma.FollowUpWhereInput {
  if (user.role === "SALES_EXECUTIVE" || user.role === "FINANCE_EXECUTIVE") return { assigneeId: user.id };
  if (user.role === "DEALER") return user.dealerId ? { lead: { dealerId: user.dealerId } } : none;
  if (user.role === "VENDOR") return user.vendorId ? { lead: { vendorId: user.vendorId } } : none;
  return {};
}

export function requirementScope(user: CurrentUser): Prisma.RequirementWhereInput {
  if (user.role === "SALES_EXECUTIVE") return { lead: { assignedToId: user.id } };
  if (user.role === "FINANCE_EXECUTIVE") return { loanCases: { some: { executiveId: user.id } } };
  if (user.role === "DEALER") return user.dealerId ? { lead: { dealerId: user.dealerId } } : none;
  if (user.role === "VENDOR") return user.vendorId ? { lead: { vendorId: user.vendorId } } : none;
  return {};
}
