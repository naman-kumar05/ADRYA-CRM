import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { NoAccess, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { createDealer } from "@/actions/partners";

export const metadata = { title: "Dealers" };

export default async function DealersPage() {
  const user = await requireUser();
  if (!can(user.role, "dealers.read")) return <NoAccess />;
  const dealers = await prisma.dealer.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { companyName: "asc" },
  });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Partners" title="Dealers" description="Register, verify, activate, then hand them only the leads they are allowed to see." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Dealer</th>
              <th className="px-3 py-3">Territory</th>
              <th className="px-3 py-3">Agreement</th>
              <th className="px-3 py-3">Leads</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((dealer) => (
              <tr key={dealer.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  <Link href={`/dealers/${dealer.id}`} className="font-semibold text-field">
                    {dealer.companyName}
                  </Link>
                  <div className="text-xs text-muted">
                    {dealer.code} · {dealer.contactName} · {dealer.mobile}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {dealer.city}, {dealer.state}
                </td>
                <td className="px-3 py-3">
                  {dealer.status} · {dealer.agreementStatus}
                </td>
                <td className="px-3 py-3">{dealer._count.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {can(user.role, "dealers.write") ? (
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Add dealer</h2>
          <form action={createDealer} className="grid gap-3 md:grid-cols-2">
            <input name="companyName" required placeholder="Company" className={fieldClass} />
            <input name="contactName" required placeholder="Contact person" className={fieldClass} />
            <input name="mobile" required placeholder="Mobile" className={fieldClass} />
            <input name="email" placeholder="Email" className={fieldClass} />
            <input name="brands" placeholder="Brands, comma separated" className={fieldClass} />
            <input name="products" placeholder="Products, comma separated" className={fieldClass} />
            <input name="state" required placeholder="State" className={fieldClass} />
            <input name="district" required placeholder="District" className={fieldClass} />
            <input name="city" required placeholder="City" className={fieldClass} />
            <input name="territory" placeholder="Territory" className={fieldClass} />
            <input name="payoutTerms" placeholder="Payout terms, from the contract" className={fieldClass} />
            <select name="status" className={fieldClass} defaultValue="New">
              <option>New</option>
              <option>Verification</option>
              <option>Active</option>
              <option>Hold</option>
              <option>Inactive</option>
            </select>
            <SubmitButton label="Save dealer" />
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
