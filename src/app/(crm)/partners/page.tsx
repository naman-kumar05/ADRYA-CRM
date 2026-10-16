import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { inr } from "@/lib/format";
import { LENDER_DECISION_NOTE } from "@/lib/constants";
import { NoAccess, PageHeader, Panel, SubmitButton, fieldClass } from "@/components/ui";
import { createPartner } from "@/actions/partners";

export const metadata = { title: "Finance partners" };

export default async function PartnersPage() {
  const user = await requireUser();
  if (!can(user.role, "partners.read")) return <NoAccess />;
  const partners = await prisma.financePartner.findMany({ include: { _count: { select: { loanCases: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Lenders" title="Finance partners" description={LENDER_DECISION_NOTE} />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Partner</th>
              <th className="px-3 py-3">Coverage</th>
              <th className="px-3 py-3">Amount range</th>
              <th className="px-3 py-3">Cases</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr key={partner.id} className="border-b border-line/80">
                <td className="px-3 py-3">
                  <Link href={`/partners/${partner.id}`} className="font-semibold text-field">
                    {partner.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {partner.code} · {partner.partnerType} · {partner.status}
                  </div>
                </td>
                <td className="px-3 py-3">{partner.states.join(", ")}</td>
                <td className="px-3 py-3">
                  {inr(partner.amountMin.toString())} – {inr(partner.amountMax.toString())}
                </td>
                <td className="px-3 py-3">{partner._count.loanCases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {can(user.role, "partners.write") ? (
        <Panel>
          <h2 className="mb-3 font-display text-2xl">Add partner</h2>
          <form action={createPartner} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Bank or NBFC name" className={fieldClass} />
            <select name="partnerType" className={fieldClass}>
              <option>Bank</option>
              <option>NBFC</option>
              <option>Other</option>
            </select>
            <input name="products" placeholder="Products, comma separated" className={fieldClass} />
            <input name="states" placeholder="States, or All" className={fieldClass} />
            <input name="loanTypes" placeholder="New, Used" className={fieldClass} />
            <input name="amountMin" placeholder="Minimum amount" className={fieldClass} />
            <input name="amountMax" placeholder="Maximum amount" className={fieldClass} />
            <input name="rmName" placeholder="Relationship manager" className={fieldClass} />
            <input name="rmMobile" placeholder="RM mobile" className={fieldClass} />
            <input name="payoutTerms" placeholder="Contract payout terms" className={fieldClass} />
            <input name="documentChecklist" placeholder="Document checklist" className={fieldClass} />
            <input name="portalReference" placeholder="Internal portal reference" className={fieldClass} />
            <SubmitButton label="Save partner" />
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
