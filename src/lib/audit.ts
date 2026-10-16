import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export async function writeAudit(
  db: Db,
  entry: {
    userId?: string | null;
    entity: string;
    entityId: string;
    action: string;
    changes?: { field: string; oldValue?: string | null; newValue?: string | null }[];
  },
) {
  const changes = entry.changes?.length ? entry.changes : [{ field: entry.action, oldValue: null, newValue: null }];
  await db.auditLog.createMany({
    data: changes.map((change) => ({
      userId: entry.userId ?? null,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      field: change.field,
      oldValue: change.oldValue ?? null,
      newValue: change.newValue ?? null,
    })),
  });
}
