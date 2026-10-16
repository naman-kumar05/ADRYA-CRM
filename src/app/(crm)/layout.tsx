import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/rbac";
import { roleLabel } from "@/lib/format";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
  return (
    <AppShell user={{ name: user.name, roleLabel: roleLabel(user.role) }} nav={navFor(user.role)} unread={unread}>
      {children}
    </AppShell>
  );
}
