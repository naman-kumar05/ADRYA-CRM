import { prisma } from "./db";

export async function loadFormOptions() {
  const [products, sources, users, territories, dealers, vendors, executives] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.territory.findMany({ orderBy: [{ state: "asc" }, { district: "asc" }, { city: "asc" }] }),
    prisma.dealer.findMany({
      where: { status: { not: "Inactive" } },
      select: { id: true, companyName: true, code: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.vendor.findMany({
      where: { status: { not: "Inactive" } },
      select: { id: true, companyName: true, code: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["FINANCE_EXECUTIVE", "FINANCE_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { products, sources, users, territories, dealers, vendors, executives };
}
