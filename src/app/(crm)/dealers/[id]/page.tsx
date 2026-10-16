import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { NoAccess, PageHeader, Panel } from "@/components/ui";
import { DEALER_LEAD_STATUSES } from "@/lib/constants";

export const metadata = { title: "Dealer" };

export default async function DealerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "dealers.read")) return <NoAccess />;
  const { id } = await params;
  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: { leads: { include: { customer: true }, orderBy: { createdAt: "desc" }, take: 40 } },
  });
  if (!dealer) notFound();
  const funnel = DEALER_LEAD_STATUSES.map((status) => ({
    status,
    count: dealer.leads.filter((lead) => lead.dealerStatus === status).length,
  }));

  return (
    <div>
      <PageHeader
        eyebrow={dealer.code}
        title={dealer.companyName}
        description={`${dealer.contactName} · ${dealer.mobile} · ${dealer.city}, ${dealer.state} · ${dealer.status}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <h2 className="font-display text-2xl">Funnel</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {funnel.map((step) => (
              <li key={step.status} className="flex justify-between">
                <span>{step.status}</span>
                <span className="font-semibold">{step.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Payout terms: {dealer.payoutTerms || "Set from the contract, not a fixed rate."}</p>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-2xl">Leads</h2>
          <ul className="space-y-2 text-sm">
            {dealer.leads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="font-semibold text-field">
                  {lead.code}
                </Link>{" "}
                · {lead.customer.name} · {lead.city} · {lead.productName} · {lead.dealerStatus}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
