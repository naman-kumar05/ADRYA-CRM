import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { roleLabel } from "@/lib/format";
import { CATEGORIES, ROLES } from "@/lib/constants";
import { NoAccess, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { addCampaign, addProduct, addSource, addStatus, addTerritory, createUser, resetUserPassword, setUserActive } from "@/actions/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.read")) return <NoAccess />;
  const [users, products, sources, dealers, vendors] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, include: { dealer: true, vendor: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.dealer.findMany({ orderBy: { companyName: "asc" } }),
    prisma.vendor.findMany({ orderBy: { companyName: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Masters" title="Settings" description="Products, places, sources and people. New products expand the CRM without a code change." />
      <Panel>
        <h2 className="mb-3 font-display text-2xl">People</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {users.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
              <span>
                {person.name} · {roleLabel(person.role)} · {person.email} · {person.active ? "Active" : "Inactive"}
              </span>
              {can(user.role, "settings.write") && person.id !== user.id ? (
                <span className="flex flex-wrap gap-2">
                  <form action={setUserActive}>
                    <input type="hidden" name="id" value={person.id} />
                    <input type="hidden" name="active" value={person.active ? "false" : "true"} />
                    <button className="rounded-lg border border-line px-2 py-1">{person.active ? "Deactivate" : "Activate"}</button>
                  </form>
                  <form action={resetUserPassword} className="flex gap-2">
                    <input type="hidden" name="id" value={person.id} />
                    <input name="password" type="password" placeholder="New password" className="rounded-lg border border-line px-2 py-1" />
                    <button className="rounded-lg border border-line px-2 py-1">Reset</button>
                  </form>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {can(user.role, "settings.write") ? (
          <form action={createUser} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Name" className={fieldClass} />
            <input name="email" type="email" required placeholder="Email" className={fieldClass} />
            <input name="mobile" placeholder="Mobile" className={fieldClass} />
            <input name="password" type="password" required minLength={8} placeholder="Password, 8+ characters" className={fieldClass} />
            <select name="role" className={fieldClass}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <input name="monthlyLeadTarget" placeholder="Monthly lead target" className={fieldClass} />
            <select name="dealerId" className={fieldClass} defaultValue="">
              <option value="">Dealer login link</option>
              {dealers.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>
                  {dealer.companyName}
                </option>
              ))}
            </select>
            <select name="vendorId" className={fieldClass} defaultValue="">
              <option value="">Vendor login link</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.companyName}
                </option>
              ))}
            </select>
            <SubmitButton label="Add user" />
          </form>
        ) : null}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Products</h2>
          <p className="mb-3 text-sm text-muted">{products.map((product) => product.name).join(", ")}</p>
          <form action={addProduct} className="grid gap-2">
            <select name="category" className={fieldClass}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <input name="name" required placeholder="New product" className={fieldClass} />
            <SubmitButton label="Add product" />
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Sources</h2>
          <p className="mb-3 text-sm text-muted">{sources.map((source) => source.name).join(", ")}</p>
          <form action={addSource} className="flex gap-2">
            <input name="name" required placeholder="New source" className={fieldClass} />
            <SubmitButton label="Add" />
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Place</h2>
          <form action={addTerritory} className="grid gap-2">
            <input name="state" required placeholder="State" className={fieldClass} />
            <input name="district" required placeholder="District" className={fieldClass} />
            <input name="city" required placeholder="City" className={fieldClass} />
            <SubmitButton label="Add place" />
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Status and campaign</h2>
          <form action={addStatus} className="mb-3 grid gap-2">
            <select name="entity" className={fieldClass}>
              <option value="lead">Lead</option>
              <option value="loan">Loan</option>
            </select>
            <input name="name" required placeholder="Status name" className={fieldClass} />
            <SubmitButton label="Add status" />
          </form>
          <form action={addCampaign} className="grid gap-2">
            <input name="name" required placeholder="Campaign name" className={fieldClass} />
            <input name="source" required placeholder="Source, e.g. Google" className={fieldClass} />
            <input name="spend" placeholder="Spend" className={fieldClass} />
            <SubmitButton label="Add campaign spend" />
          </form>
        </Panel>
      </div>
      <Panel>
        <h2 className="font-display text-2xl">Website intake</h2>
        <p className="mt-2 text-sm text-muted">
          POST /api/intake with header x-api-key. Body: name, mobile, source, category, productName, state, district, city, loanRequired, loanAmount.
          The key lives in the server environment, not in the browser.
        </p>
      </Panel>
    </div>
  );
}
