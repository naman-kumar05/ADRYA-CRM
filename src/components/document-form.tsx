"use client";

import { useActionState } from "react";
import { saveDocument } from "@/actions/documents";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@/lib/constants";
import { SubmitButton, fieldClass } from "./ui";

export function DocumentForm({ loanCaseId }: { loanCaseId: string }) {
  const [state, action] = useActionState(async (_prev: { error?: string } | null, formData: FormData) => saveDocument(formData), null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="loanCaseId" value={loanCaseId} />
      <select name="docType" className={fieldClass}>
        {DOCUMENT_TYPES.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
      <select name="status" className={fieldClass} defaultValue="Uploaded">
        {DOCUMENT_STATUSES.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={fieldClass} />
      <input name="notes" placeholder="Note" className={fieldClass} />
      {state?.error ? <p className="text-sm text-hot md:col-span-2">{state.error}</p> : null}
      <SubmitButton label="Save document" />
    </form>
  );
}
