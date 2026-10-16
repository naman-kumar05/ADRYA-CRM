export function partnerFits(
  partner: {
    status: string;
    products: string[];
    states: string[];
    amountMin: number;
    amountMax: number;
  },
  lead: { category: string; productName: string; state: string; loanAmount: number | null },
) {
  if (partner.status !== "Active") return false;
  const amount = lead.loanAmount ?? 0;
  if (amount > 0 && (amount < partner.amountMin || amount > partner.amountMax)) return false;
  const stateOk =
    partner.states.length === 0 || partner.states.includes("All") || partner.states.includes(lead.state);
  const productOk =
    partner.products.length === 0 ||
    partner.products.some((product) => {
      const name = product.toLowerCase();
      return (
        name === lead.productName.toLowerCase() ||
        name === lead.category.toLowerCase() ||
        lead.productName.toLowerCase().includes(name) ||
        name.includes(lead.category.toLowerCase())
      );
    });
  return stateOk && productOk;
}
