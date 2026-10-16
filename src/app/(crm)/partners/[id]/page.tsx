import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { inr } from "@/lib/format";
import { LENDER_DECISION_NOTE } from "@/lib/constants";
import { NoAccess, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Finance partner" };

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "partners.read")) return <NoAccess />;
  const { id } = await params;
  const partner = await prisma.financePartner.findUnique({
    where: { id },
    include: { loanCases: { include: { customer: true }, orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!partner) notFound();
  return (
    <div>
      <PageHeader eyebrow={partner.code} title={partner.name} description={`${partner.partnerType} · ${partner.status} · ${LENDER_DECISION_NOTE}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <p className="text-sm">Products: {partner.products.join(", ") || "—"}</p>
          <p className="text-sm">States: {partner.states.join(", ") || "—"}</p>
          <p className="text-sm">
            Range: {inr(partner.amountMin.toString())} – {inr(partner.amountMax.toString())}
          </p>
          <p className="text-sm">RM: {partner.rmName || "—"} {partner.rmMobile || ""}</p>
          <p className="text-sm">Payout terms: {partner.payoutTerms || "Contract reference not set"}</p>
          <p className="text-sm">Checklist: {partner.documentChecklist || "—"}</p>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-2xl">Cases</h2>
          <ul className="space-y-2 text-sm">
            {partner.loanCases.map((loan) => (
              <li key={loan.id}>
                <Link href={`/loans/${loan.id}`} className="font-semibold text-field">
                  {loan.code}
                </Link>{" "}
                · {loan.customer.name} · {loan.status} · {inr(loan.loanAmount.toString())}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
