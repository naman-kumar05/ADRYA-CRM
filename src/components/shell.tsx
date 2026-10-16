"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/actions/auth";
import type { NavItem } from "@/lib/rbac";

export function AppShell({
  user,
  nav,
  unread,
  children,
}: {
  user: { name: string; roleLabel: string };
  nav: NavItem[];
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const phoneNav = nav.filter((item) => ["/pipeline", "/leads", "/follow-ups"].includes(item.href));

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[16.5rem_1fr]">
      {open ? <button className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-field-dark text-white transition lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass-2">Operations</p>
          <p className="font-display text-3xl leading-none">ADYRA</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block min-h-11 rounded-xl px-3 py-3 text-sm ${active ? "bg-white/12 font-semibold text-white" : "text-white/75 hover:bg-white/8 hover:text-white"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-white/60">{user.roleLabel}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 py-2">
            <button
              type="button"
              className="min-h-11 rounded-xl border border-line bg-card px-3 text-sm lg:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <form action="/leads" className="hidden min-w-0 flex-1 md:block">
              <input
                name="q"
                placeholder="Search leads, customers, mobiles"
                className="min-h-11 w-full max-w-md rounded-xl border border-line bg-card px-3 text-base outline-none focus:border-field md:text-sm"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/notifications" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-3 text-sm">
                Alerts{unread ? ` (${unread})` : ""}
              </Link>
              <form action={logout}>
                <button className="min-h-11 rounded-xl px-3 text-sm text-muted hover:text-ink">Sign out</button>
              </form>
            </div>
          </div>
          <form action="/leads" className="pb-2 md:hidden">
            <input
              name="q"
              placeholder="Search name or mobile"
              className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus:border-field"
            />
          </form>
        </header>
        <main className="px-3 py-4 pb-28 lg:px-8 lg:py-6 lg:pb-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
          {phoneNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-1 items-center justify-center px-1 text-center text-xs font-semibold ${active ? "text-field" : "text-muted"}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button type="button" className="min-h-14 flex-1 text-xs font-semibold text-muted" onClick={() => setOpen(true)}>
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
