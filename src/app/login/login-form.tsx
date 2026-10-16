"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";
import { SubmitButton, fieldClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, action] = useActionState(login, null as FormState);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-field-dark px-12 py-12 text-white lg:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass-2">ADYRA CRM</p>
          <h1 className="mt-6 max-w-md font-display text-5xl leading-tight">From the first call to the payout.</h1>
        </div>
        <p className="max-w-sm text-sm text-white/70">
          Tractor, machinery, solar, loans and insurance. One customer, many requirements, and a record of every handoff.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <form action={action} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden">
            <p className="font-display text-4xl">ADYRA</p>
          </div>
          <h2 className="font-display text-3xl">Sign in</h2>
          {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-hot">{state.error}</p> : null}
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Email</span>
            <input name="email" type="email" required autoComplete="username" className={fieldClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className={fieldClass} />
          </label>
          <SubmitButton label="Sign in" pendingLabel="Signing in…" />
          <p className="text-xs text-muted">Password reset is done by an admin until email delivery is connected.</p>
        </form>
      </section>
    </div>
  );
}
