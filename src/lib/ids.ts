import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export async function nextCode(db: Db, key: string, prefix: string, width: number) {
  const year = new Date().getFullYear();
  const id = `${key}-${year}`;
  const row = await db.counter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(row.value).padStart(width, "0")}`;
}
