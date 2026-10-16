import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { customerScope } from "@/lib/scope";
import { when } from "@/lib/format";
import { PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: {
      ...customerScope(user),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { leads: true, requirements: true, loanCases: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader eyebrow="Master" title="Customers" description="One person can have a tractor requirement, a loan, insurance and solar without a second profile." />
      <form className="mb-4" method="get">
        <input name="q" defaultValue={q} placeholder="Name, mobile or customer id" className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2 text-sm" />
      </form>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Place</th>
              <th className="px-3 py-3">Leads</th>
              <th className="px-3 py-3">Requirements</th>
              <th className="px-3 py-3">Cases</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  <Link href={`/customers/${customer.id}`} className="font-semibold text-field">
                    {customer.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {customer.code} · {customer.mobile} · {when(customer.createdAt, false)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {customer.city}, {customer.state}
                </td>
                <td className="px-3 py-3">{customer._count.leads}</td>
                <td className="px-3 py-3">{customer._count.requirements}</td>
                <td className="px-3 py-3">{customer._count.loanCases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
