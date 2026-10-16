import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, seesFullHistory } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { customerScope, leadScope, loanScope } from "@/lib/scope";
import { inr, when } from "@/lib/format";
import { PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const customer = await prisma.customer.findFirst({ where: { id, ...customerScope(user) } });
  if (!customer) notFound();
  const full = seesFullHistory(user.role);

  const [leads, requirements, loans] = await Promise.all([
    prisma.lead.findMany({
      where: { customerId: customer.id, ...(full ? {} : leadScope(user)) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.requirement.findMany({
      where: full ? { customerId: customer.id } : { customerId: customer.id, lead: leadScope(user) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loanCase.findMany({
      where: { customerId: customer.id, ...(full ? {} : loanScope(user)) },
      include: { lender: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={customer.code}
        title={customer.name}
        description={`${customer.mobile}${customer.email ? ` · ${customer.email}` : ""} · ${customer.city}, ${customer.district}, ${customer.state}`}
        action={
          can(user.role, "leads.write") ? (
            <Link href={`/leads/new?customerId=${customer.id}`} className="rounded-xl bg-field px-4 py-2 text-sm font-semibold text-white">
              New requirement
            </Link>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="font-display text-2xl">Profile</h2>
          <p className="mt-2 text-sm">Occupation: {customer.occupation || "—"}</p>
          <p className="text-sm">Address: {customer.address || "—"}</p>
          <p className="text-sm">Pincode: {customer.pincode || "—"}</p>
          <p className="text-sm">Since {when(customer.createdAt, false)}</p>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-2xl">Requirements</h2>
          <ul className="space-y-2 text-sm">
            {requirements.map((item) => (
              <li key={item.id}>
                {item.code} · {item.productName} · {item.status} · {inr(item.loanAmount?.toString() || item.budget?.toString())}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Leads</h2>
          <ul className="space-y-2 text-sm">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link className="font-semibold text-field" href={`/leads/${lead.id}`}>
                  {lead.code}
                </Link>{" "}
                · {lead.productName} · {lead.status}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Finance cases</h2>
          {loans.length === 0 ? <p className="text-sm text-muted">No finance case on the records you can see.</p> : null}
          <ul className="space-y-2 text-sm">
            {loans.map((loan) => (
              <li key={loan.id}>
                <Link className="font-semibold text-field" href={`/loans/${loan.id}`}>
                  {loan.code}
                </Link>{" "}
                · {loan.status} · {loan.lender?.name || "No lender"} · {inr(loan.loanAmount.toString())}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
