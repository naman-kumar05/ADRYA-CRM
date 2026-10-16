import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { NoAccess, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { createVendor } from "@/actions/partners";

export const metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const user = await requireUser();
  if (!can(user.role, "vendors.read")) return <NoAccess />;
  const vendors = await prisma.vendor.findMany({ include: { _count: { select: { leads: true } } }, orderBy: { companyName: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Partners" title="Vendors" description="Solar and other installers. They only see leads assigned to them." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Vendor</th>
              <th className="px-3 py-3">Area</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Leads</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  {vendor.companyName}
                  <div className="text-xs text-muted">
                    {vendor.code} · {vendor.contactName} · {vendor.mobile}
                  </div>
                </td>
                <td className="px-3 py-3">{vendor.serviceArea}</td>
                <td className="px-3 py-3">{vendor.status}</td>
                <td className="px-3 py-3">{vendor._count.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {can(user.role, "vendors.write") ? (
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Add vendor</h2>
          <form action={createVendor} className="grid gap-3 md:grid-cols-2">
            <input name="companyName" required placeholder="Company" className={fieldClass} />
            <input name="contactName" required placeholder="Contact" className={fieldClass} />
            <input name="mobile" required placeholder="Mobile" className={fieldClass} />
            <input name="serviceArea" placeholder="Service area" className={fieldClass} />
            <input name="products" placeholder="Products, comma separated" className={fieldClass} />
            <input name="capacity" placeholder="Capacity" className={fieldClass} />
            <input name="installCapability" placeholder="Installation capability" className={fieldClass} />
            <input name="pricingReference" placeholder="Pricing reference" className={fieldClass} />
            <input name="state" required placeholder="State" className={fieldClass} />
            <input name="district" required placeholder="District" className={fieldClass} />
            <input name="city" required placeholder="City" className={fieldClass} />
            <input name="payoutTerms" placeholder="Contract payout terms" className={fieldClass} />
            <SubmitButton label="Save vendor" />
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
