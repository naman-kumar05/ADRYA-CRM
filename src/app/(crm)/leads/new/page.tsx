import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { NoAccess, PageHeader, Panel } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";
import { loadFormOptions } from "@/lib/options";
import { prisma } from "@/lib/db";
import { customerScope } from "@/lib/scope";

export const metadata = { title: "New lead" };

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "leads.write")) return <NoAccess />;
  const { customerId } = await searchParams;
  const options = await loadFormOptions();
  const preset = customerId
    ? await prisma.customer.findFirst({ where: { id: customerId, ...customerScope(user) } })
    : null;

  return (
    <div>
      <PageHeader eyebrow="Intake" title="New lead" description="A mobile that already exists stays on that customer. You choose a new requirement or another lead." />
      <Panel>
        <LeadForm
          products={options.products.map((product) => ({ category: product.category, name: product.name }))}
          sources={options.sources.map((source) => source.name)}
          assignees={options.users.map((person) => ({ id: person.id, name: person.name }))}
          territories={options.territories}
          dealers={options.dealers.map((dealer) => ({ id: dealer.id, name: dealer.companyName }))}
          vendors={options.vendors.map((vendor) => ({ id: vendor.id, name: vendor.companyName }))}
          canAssign={can(user.role, "leads.assign")}
          preset={
            preset
              ? {
                  id: preset.id,
                  name: preset.name,
                  mobile: preset.mobile,
                  altMobile: preset.altMobile,
                  email: preset.email,
                  state: preset.state,
                  district: preset.district,
                  city: preset.city,
                  pincode: preset.pincode,
                }
              : null
          }
        />
      </Panel>
    </div>
  );
}
