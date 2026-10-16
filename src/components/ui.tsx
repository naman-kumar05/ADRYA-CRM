"use client";

import { useFormStatus } from "react-dom";

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none transition focus:border-field md:text-sm";

export function SubmitButton({ label, pendingLabel = "Saving…" }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-field px-4 py-2 text-sm font-semibold text-white transition hover:bg-field-dark disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "hot" | "warm" | "cold" | "good" | "bad" | "info" | "brass";
}) {
  const tones = {
    neutral: "bg-paper text-ink",
    hot: "bg-red-50 text-hot",
    warm: "bg-amber-50 text-warm",
    cold: "bg-blue-50 text-cold",
    good: "bg-field-2 text-field-dark",
    bad: "bg-red-50 text-hot",
    info: "bg-blue-50 text-cold",
    brass: "bg-brass-2 text-brass",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl tracking-tight text-ink break-words sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

export function NoAccess() {
  return (
    <Panel>
      <h1 className="font-display text-2xl">This page is outside your role</h1>
      <p className="mt-2 text-sm text-muted">Ask an admin if you need access. Your other records are unchanged.</p>
    </Panel>
  );
}

export function TextField({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <input name={name} className={fieldClass} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  children,
  defaultValue,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange}
        required={required}
        className={fieldClass}
      >
        {children}
      </select>
    </label>
  );
}
