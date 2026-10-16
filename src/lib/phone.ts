export function phoneDigits(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

export function telHref(mobile: string) {
  return `tel:+${phoneDigits(mobile)}`;
}

export function whatsAppHref(mobile: string, text: string) {
  return `https://wa.me/${phoneDigits(mobile)}?text=${encodeURIComponent(text)}`;
}

export function fillTemplate(
  template: string,
  values: { name: string; product: string; code: string; stage: string; missing: string },
) {
  return template
    .replaceAll("{name}", values.name)
    .replaceAll("{product}", values.product)
    .replaceAll("{code}", values.code)
    .replaceAll("{stage}", values.stage)
    .replaceAll("{missing}", values.missing || "the pending papers");
}
