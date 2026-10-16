"use client";

import { useState } from "react";
import { logWhatsApp } from "@/actions/pipeline";

export function WhatsAppButton({ href, leadId, label }: { href: string; leadId: string; label: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        window.open(href, "_blank", "noopener,noreferrer");
        setPending(true);
        await logWhatsApp(leadId, label);
        setPending(false);
      }}
      className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-field"
    >
      {pending ? "Opening…" : label}
    </button>
  );
}
