import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { followUpScope } from "@/lib/scope";
import { when } from "@/lib/format";
import { FOLLOWUP_RESULTS } from "@/lib/constants";
import { PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { completeFollowUp } from "@/actions/followups";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { view } = await searchParams;
  const now = new Date();
  const where = {
    ...followUpScope(user),
    ...(view === "overdue" ? { completedAt: null, dueAt: { lt: now } } : {}),
    ...(view === "open" ? { completedAt: null } : {}),
    ...(view === "done" ? { completedAt: { not: null } } : {}),
  };
  const tasks = await prisma.followUp.findMany({
    where,
    include: { lead: { include: { customer: true } }, assignee: true },
    orderBy: { dueAt: "asc" },
    take: 80,
  });
  return (
    <div>
      <PageHeader eyebrow="Work queue" title="Follow-ups" description="Overdue tasks stay visible until someone records a result." />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/follow-ups" className="rounded-full bg-card px-3 py-1">All</Link>
        <Link href="/follow-ups?view=open" className="rounded-full bg-card px-3 py-1">Open</Link>
        <Link href="/follow-ups?view=overdue" className="rounded-full bg-card px-3 py-1">Overdue</Link>
        <Link href="/follow-ups?view=done" className="rounded-full bg-card px-3 py-1">Done</Link>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => {
          const overdue = !task.completedAt && task.dueAt < now;
          return (
            <Panel key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {task.type}
                    {overdue ? " · overdue" : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {when(task.dueAt)} · {task.assignee.name}
                    {task.lead ? (
                      <>
                        {" "}
                        · <Link className="text-field" href={`/leads/${task.lead.id}`}>{task.lead.code}</Link> {task.lead.customer.name}
                      </>
                    ) : null}
                  </p>
                  {task.notes ? <p className="mt-1 text-sm">{task.notes}</p> : null}
                  {task.result ? <p className="mt-1 text-sm">Result: {task.result}</p> : null}
                </div>
                {!task.completedAt && can(user.role, "followups.write") ? (
                  <form action={completeFollowUp} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={task.id} />
                    <select name="result" className={fieldClass}>
                      {FOLLOWUP_RESULTS.map((result) => (
                        <option key={result}>{result}</option>
                      ))}
                    </select>
                    <SubmitButton label="Complete" />
                  </form>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
