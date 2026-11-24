import { callStatus, productLabel, sourceLabel, stage } from "@/lib/constants";

export function StageChip({ code, status }: { code: string; status?: string | null }) {
  const s = stage(code);
  const cs = code === "followup" ? callStatus(status) : null;
  return <span className={`chip ${cs ? cs.tone : s.tone}`}>{cs ? `Arandı – ${cs.label}` : s.label}</span>;
}

export function ProductChip({ code }: { code: string }) {
  return <span className="chip border-navy-l bg-[#eef1f8] text-navy">{productLabel(code)}</span>;
}

export function SourceChip({ code, detail }: { code: string; detail?: Record<string, string> }) {
  const label = code === "meta" && detail?.platform ? detail.platform : sourceLabel(code);
  const tone =
    code === "meta"
      ? "border-[#d9c9f5] bg-[#f4effd] text-[#5b3a9b]"
      : code === "website"
        ? "border-cream-d bg-cream text-navy"
        : "border-line bg-white text-ink-2";
  return <span className={`chip ${tone}`}>{label}</span>;
}

export function KindChip({ kind }: { kind: string }) {
  if (kind !== "kurumsal") return null;
  return <span className="chip border-navy-l bg-navy text-cream">Kurumsal</span>;
}

/** Name cell for lists: company with contact person underneath, or the person's name. */
export function NameCell({ c, href, sub }: { c: { kind: string; fullName: string; contactPerson: string | null; sector?: string | null }; href: string; sub?: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={href} className="font-medium hover:underline">
          {c.fullName}
        </a>
        <KindChip kind={c.kind} />
      </div>
      {c.kind === "kurumsal" && c.contactPerson && c.contactPerson !== c.fullName && (
        <div className="text-xs text-ink-2">
          Yetkili: {c.contactPerson}
          {c.sector && ` · ${c.sector}`}
        </div>
      )}
      {sub}
    </>
  );
}

export function LifecycleChip({ value }: { value: string }) {
  return value === "customer" ? (
    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">Müşteri</span>
  ) : (
    <span className="chip border-orange-200 bg-orange-50 text-orange-800">Potansiyel</span>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-navy">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
