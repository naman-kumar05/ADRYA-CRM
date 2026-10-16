"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextCode } from "@/lib/ids";
import { parseAmount } from "@/lib/format";

function splitList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createDealer(formData: FormData) {
  const user = await requireAction("dealers.write");
  if (!user) return;
  const companyName = String(formData.get("companyName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const mobile = String(formData.get("mobile") || "").trim();
  if (!companyName || !contactName || !/^[6-9]\d{9}$/.test(mobile)) return;
  const dealer = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, "dealer", "ADY-DL", 4);
    return tx.dealer.create({
      data: {
        code,
        companyName,
        contactName,
        mobile,
        email: String(formData.get("email") || "") || null,
        brands: splitList(formData.get("brands")),
        products: splitList(formData.get("products")),
        state: String(formData.get("state") || ""),
        district: String(formData.get("district") || ""),
        city: String(formData.get("city") || ""),
        territory: String(formData.get("territory") || "") || null,
        agreementStatus: String(formData.get("agreementStatus") || "Pending"),
        payoutTerms: String(formData.get("payoutTerms") || "") || null,
        status: String(formData.get("status") || "New"),
      },
    });
  });
  revalidatePath("/dealers");
  redirect(`/dealers/${dealer.id}`);
}

export async function createVendor(formData: FormData) {
  const user = await requireAction("vendors.write");
  if (!user) return;
  const companyName = String(formData.get("companyName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const mobile = String(formData.get("mobile") || "").trim();
  if (!companyName || !contactName || !/^[6-9]\d{9}$/.test(mobile)) return;
  await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, "vendor", "ADY-VN", 4);
    await tx.vendor.create({
      data: {
        code,
        companyName,
        contactName,
        mobile,
        email: String(formData.get("email") || "") || null,
        serviceArea: String(formData.get("serviceArea") || ""),
        products: splitList(formData.get("products")),
        capacity: String(formData.get("capacity") || "") || null,
        installCapability: String(formData.get("installCapability") || "") || null,
        pricingReference: String(formData.get("pricingReference") || "") || null,
        agreementStatus: String(formData.get("agreementStatus") || "Pending"),
        payoutTerms: String(formData.get("payoutTerms") || "") || null,
        status: String(formData.get("status") || "New"),
        state: String(formData.get("state") || ""),
        district: String(formData.get("district") || ""),
        city: String(formData.get("city") || ""),
      },
    });
  });
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function createPartner(formData: FormData) {
  const user = await requireAction("partners.write");
  if (!user) return;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const partner = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, "partner", "ADY-FP", 4);
    return tx.financePartner.create({
      data: {
        code,
        name,
        partnerType: String(formData.get("partnerType") || "NBFC"),
        products: splitList(formData.get("products")),
        states: splitList(formData.get("states")),
        loanTypes: splitList(formData.get("loanTypes")),
        amountMin: parseAmount(formData.get("amountMin")) ?? 0,
        amountMax: parseAmount(formData.get("amountMax")) ?? 0,
        documentChecklist: String(formData.get("documentChecklist") || "") || null,
        rmName: String(formData.get("rmName") || "") || null,
        rmMobile: String(formData.get("rmMobile") || "") || null,
        portalReference: String(formData.get("portalReference") || "") || null,
        payoutTerms: String(formData.get("payoutTerms") || "") || null,
        status: String(formData.get("status") || "Active"),
      },
    });
  });
  revalidatePath("/partners");
  redirect(`/partners/${partner.id}`);
}
