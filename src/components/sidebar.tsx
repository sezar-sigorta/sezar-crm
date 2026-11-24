"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { initials } from "@/lib/format";

const NAV = [
  { href: "/", label: "Pano", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/talepler", label: "Talepler", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z" },
  { href: "/leadler", label: "Leadler", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20v-1a6 6 0 0112 0v1M19 8v6M16 11h6" },
  { href: "/musteriler", label: "Müşteriler", icon: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM17 11l2 2 4-4" },
  { href: "/raporlar", label: "Raporlar", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: "M9 7H6a3 3 0 000 6h3M15 7h3a3 3 0 010 6h-3M8 10h8" },
];

export function Sidebar({ userName, newCount }: { userName: string; newCount: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside className="sticky top-0 z-20 flex flex-col bg-navy text-cream md:h-dvh">
      <div className="flex items-center gap-3 px-5 py-4 md:py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-8 rounded-lg ring-1 ring-cream/15" />
        <div className="font-display text-lg font-semibold">Sezar CRM</div>
        <Link href="/kisiler/yeni" className="ml-auto rounded-lg bg-cream px-2.5 py-1 text-xs font-semibold text-navy md:hidden">
          + Yeni
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Ana menü">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active(n.href) ? "bg-navy-3 text-white" : "text-navy-l hover:bg-navy-2 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={n.icon} />
            </svg>
            {n.label}
            {n.href === "/talepler" && newCount > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{newCount}</span>
            )}
          </Link>
        ))}
        <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2">
          <Link href="/kisiler/yeni" className="rounded-lg bg-cream px-2 py-2 text-center text-sm font-semibold text-navy hover:bg-white">
            + Lead
          </Link>
          <Link href="/kisiler/yeni?tur=musteri" className="rounded-lg border border-cream/40 px-2 py-2 text-center text-sm font-semibold text-cream hover:bg-navy-2">
            + Müşteri
          </Link>
        </div>
      </nav>
      <div className="mt-auto hidden items-center gap-3 border-t border-navy-3 px-5 py-4 md:flex">
        <span className="grid size-8 place-items-center rounded-full bg-navy-3 text-xs font-semibold">{initials(userName)}</span>
        <span className="truncate text-sm">{userName}</span>
        <form action={logout} className="ml-auto">
          <button className="text-xs text-navy-l hover:text-white" title="Çıkış yap">
            Çıkış
          </button>
        </form>
      </div>
    </aside>
  );
}
