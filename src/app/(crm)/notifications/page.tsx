import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { when } from "@/lib/format";
import { PageHeader, Panel, SubmitButton } from "@/components/ui";
import { markNotificationsRead } from "@/actions/notifications";

export const metadata = { title: "Alerts" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notes = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Alerts"
        description="Assignments and dealer responses land here. WhatsApp and SMS need a provider before they can send."
        action={
          <form action={markNotificationsRead}>
            <SubmitButton label="Mark all read" />
          </form>
        }
      />
      <div className="space-y-2">
        {notes.length === 0 ? <Panel>No alerts yet.</Panel> : null}
        {notes.map((note) => (
          <Panel key={note.id}>
            <p className="font-semibold">{note.title}</p>
            <p className="text-sm">{note.body}</p>
            <p className="text-xs text-muted">
              {when(note.createdAt)} · {note.read ? "Read" : "Unread"}
              {note.href ? (
                <>
                  {" "}
                  · <Link className="text-field" href={note.href}>Open</Link>
                </>
              ) : null}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
