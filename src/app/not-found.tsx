import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <p className="font-display text-4xl">That record is not available</p>
      <p className="mt-3 text-sm text-muted">It may belong to another person, or the link is old.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-field">
        Back to dashboard
      </Link>
    </div>
  );
}
