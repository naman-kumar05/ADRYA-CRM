import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { when } from "@/lib/format";
import { NoAccess, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user.role, "audit.read")) return <NoAccess />;
  const rows = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <PageHeader eyebrow="Control" title="Audit log" description="Critical changes keep the person, the field, the old value and the new value." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">When</th>
              <th className="px-3 py-3">Who</th>
              <th className="px-3 py-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/80">
                <td className="px-3 py-3">{when(row.createdAt)}</td>
                <td className="px-3 py-3">{row.user?.name || "System"}</td>
                <td className="px-3 py-3">
                  {row.entity} · {row.action}
                  {row.field ? ` · ${row.field}: ${row.oldValue || "—"} → ${row.newValue || "—"}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
