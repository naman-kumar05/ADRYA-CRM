"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/constants";
import { parseAmount } from "@/lib/format";

function splitList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createUser(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "") as Role;
  if (!name || !email || password.length < 8 || !(ROLES as readonly string[]).includes(role)) return;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      mobile: String(formData.get("mobile") || "") || null,
      passwordHash,
      role,
      monthlyLeadTarget: parseAmount(formData.get("monthlyLeadTarget")),
      dealerId: role === "DEALER" ? String(formData.get("dealerId") || "") || null : null,
      vendorId: role === "VENDOR" ? String(formData.get("vendorId") || "") || null : null,
    },
  });
  await writeAudit(prisma, {
    userId: actor.id,
    entity: "user",
    entityId: user.id,
    action: "user.create",
    changes: [{ field: "role", newValue: role }],
  });
  revalidatePath("/settings");
}

export async function setUserActive(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const id = String(formData.get("id") || "");
  if (id === actor.id) return;
  const active = formData.get("active") === "true";
  await prisma.user.update({ where: { id }, data: { active } });
  await writeAudit(prisma, {
    userId: actor.id,
    entity: "user",
    entityId: id,
    action: "user.active",
    changes: [{ field: "active", newValue: String(active) }],
  });
  revalidatePath("/settings");
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) return;
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await writeAudit(prisma, {
    userId: actor.id,
    entity: "user",
    entityId: id,
    action: "user.password",
    changes: [{ field: "password", newValue: "reset" }],
  });
  revalidatePath("/settings");
}

export async function addProduct(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!category || !name) return;
  await prisma.product.upsert({
    where: { category_name: { category, name } },
    create: { category, name },
    update: { active: true },
  });
  revalidatePath("/settings");
}

export async function addSource(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.leadSource.upsert({ where: { name }, create: { name }, update: { active: true } });
  revalidatePath("/settings");
}

export async function addStatus(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const entity = String(formData.get("entity") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const sort = Number(formData.get("sort") || 100);
  if (!entity || !name) return;
  await prisma.statusOption.upsert({
    where: { entity_name: { entity, name } },
    create: { entity, name, sort },
    update: { active: true, sort },
  });
  revalidatePath("/settings");
}

export async function addTerritory(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const state = String(formData.get("state") || "").trim();
  const district = String(formData.get("district") || "").trim();
  const city = String(formData.get("city") || "").trim();
  if (!state || !district || !city) return;
  await prisma.territory.upsert({
    where: { state_district_city: { state, district, city } },
    create: { state, district, city },
    update: {},
  });
  revalidatePath("/settings");
}

export async function addCampaign(formData: FormData) {
  const actor = await requireAction("settings.write");
  if (!actor) return;
  const name = String(formData.get("name") || "").trim();
  const source = String(formData.get("source") || "").trim();
  if (!name || !source) return;
  await prisma.campaign.create({
    data: { name, source, spend: parseAmount(formData.get("spend")) ?? 0 },
  });
  revalidatePath("/settings");
  revalidatePath("/reports");
}
