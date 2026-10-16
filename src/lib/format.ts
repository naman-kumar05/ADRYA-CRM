export function inr(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function num(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isNaN(amount) ? null : amount;
}

export function when(value: Date | string | null | undefined, withTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
  }).format(new Date(value));
}

export function priorityTone(priority: string): "hot" | "warm" | "cold" {
  if (priority === "HOT") return "hot";
  if (priority === "COLD") return "cold";
  return "warm";
}

export function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const amount = Number(raw);
  if (Number.isNaN(amount) || amount < 0) return null;
  return amount;
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
