import Link from "next/link";
import { callStatus, productLabel, platformLabel, sourceLabel, stage } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Outline badge in one of the tone classes from constants.ts. */
export function Chip({ tone, className, children }: { tone?: string; className?: string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("h-auto min-h-5", tone, className)}>
      {children}
    </Badge>
  );
}

export function StageChip({ code, status }: { code: string; status?: string | null }) {
  const s = stage(code);
  const cs = code === "followup" ? callStatus(status) : null;
  return <Chip tone={cs ? cs.tone : s.tone}>{cs ? `Arandı – ${cs.label}` : s.label}</Chip>;
}

export function ProductChip({ code }: { code: string }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {productLabel(code)}
    </Badge>
  );
}

const SOURCE_DOT: Record<string, string> = { meta: "bg-[#6d4fc2]", website: "bg-navy", whatsapp: "bg-wa", phone: "bg-sky-500" };

export function SourceChip({ code, detail }: { code: string; detail?: Record<string, string> }) {
  const label = code === "meta" && detail?.platform ? platformLabel(detail.platform) : sourceLabel(code);
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", SOURCE_DOT[code] ?? "bg-muted-foreground/60")} aria-hidden />
      {label}
    </Badge>
  );
}

export function KindChip({ kind }: { kind: string }) {
  if (kind !== "kurumsal") return null;
  return <Badge variant="secondary">Kurumsal</Badge>;
}

/** Name cell for lists: company with contact person underneath, or the person's name. */
export function NameCell({ c, href, sub }: { c: { kind: string; fullName: string; contactPerson: string | null; sector?: string | null }; href: string; sub?: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={href} className="font-medium hover:underline">
          {c.fullName}
        </Link>
        <KindChip kind={c.kind} />
      </div>
      {c.kind === "kurumsal" && c.contactPerson && c.contactPerson !== c.fullName && (
        <div className="text-xs text-muted-foreground">
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
    <Chip tone="border-emerald-200 bg-emerald-50 text-emerald-800">Müşteri</Chip>
  ) : (
    <Chip tone="border-orange-200 bg-orange-50 text-orange-800">Potansiyel</Chip>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
