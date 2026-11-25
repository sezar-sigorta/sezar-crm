import Link from "next/link";
import { PageHeader } from "@/components/chips";
import { type ReportRow, ReportsView } from "@/components/reports-view";
import { StatCard as Stat, StatGrid } from "@/components/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { channelOf, formLabel, sourceLabel } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { type ReportGroup, campaignReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

const GROUPS: { v: ReportGroup; label: string; col: string }[] = [
  { v: "form", label: "Formlar", col: "Form" },
  { v: "campaign", label: "Kampanyalar", col: "Kampanya" },
  { v: "ad", label: "Reklamlar", col: "Reklam" },
];
const PERIODS = [
  { v: "7", label: "7 gün" },
  { v: "30", label: "30 gün" },
  { v: "90", label: "90 gün" },
  { v: "all", label: "Tümü" },
];
/** Below this many leads a rate says little. */
const MIN_SAMPLE = 5;

export default async function Raporlar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const group = (GROUPS.find((g) => g.v === sp.grup)?.v ?? "form") as ReportGroup;
  const period = PERIODS.find((p) => p.v === sp.donem)?.v ?? "30";
  const rows = await campaignReport(group, period === "all" ? null : Number(period));
  const col = GROUPS.find((g) => g.v === group)!.col;
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ grup: group, donem: period, ...o })}`;

  const total = rows.reduce((a, r) => a + r.total, 0);
  const won = rows.reduce((a, r) => a + r.won, 0);
  const reached = rows.reduce((a, r) => a + r.reached, 0);
  const tracked = rows.filter((r) => r.key && r.total >= MIN_SAMPLE);
  const best = tracked.length ? tracked.reduce((a, r) => (r.won / r.total > a.won / a.total ? r : a)) : null;
  const view: ReportRow[] = rows.map((r) => ({
    id: `${r.source}|${r.parent}|${r.key}`,
    name: formLabel(r.key),
    missing: r.source === "meta" || r.source === "website" ? `(${col.toLocaleLowerCase("tr")} bilgisi yok)` : "Elle eklenenler",
    href: r.key
      ? `/talepler?${new URLSearchParams(group === "form" ? { form: r.key } : { kampanya: group === "ad" ? (r.parent ?? "") : r.key })}`
      : `/talepler?${new URLSearchParams({ kaynak: channelOf(r.source) })}`,
    meta: `${sourceLabel(r.source)}${r.parent ? ` · ${r.parent}` : ""} · ${fmtDate(r.first)}${r.first.toDateString() !== r.last.toDateString() ? ` – ${fmtDate(r.last)}` : ""}`,
    products: r.products,
    total: r.total,
    reached: r.reached,
    won: r.won,
    avgFirstResponseMin: r.avgFirstResponseMin,
    waiting: r.waiting,
    lost: r.lost,
    topLostReason: r.topLostReason,
  }));

  return (
    <>
      <PageHeader title="Raporlar" sub="Hangi form, kampanya ve reklam lead getiriyor, hangisi satışa dönüyor." />

      <div className="flex flex-wrap items-center gap-3">
        <LinkTabs label="Gruplama" value={group} items={GROUPS.map((g) => ({ v: g.v, label: g.label, href: `/raporlar${qs({ grup: g.v })}` }))} />
        <LinkTabs label="Dönem" value={period} items={PERIODS.map((p) => ({ v: p.v, label: p.label, href: `/raporlar${qs({ donem: p.v })}` }))} />
      </div>

      <StatGrid>
        <Stat label="Toplam talep" value={String(total)} foot={`${rows.length} ${col.toLocaleLowerCase("tr")}`} sub="Seçili dönemde gelen" />
        <Stat label="Ulaşılan" value={pct(reached, total)} foot={`${reached} talep`} sub="İlk dönüşü yapılanlar" />
        <Stat label="Kazanılan" value={pct(won, total)} foot={`${won} talep`} sub="Poliçeye dönenler" />
        <Stat
          label={`En iyi dönüşen ${col.toLocaleLowerCase("tr")}`}
          value={best ? pct(best.won, best.total) : "—"}
          foot={best ? (formLabel(best.key) ?? "—") : "Yeterli veri yok"}
          sub={`En az ${MIN_SAMPLE} talebi olanlar arasında`}
        />
      </StatGrid>

      <ReportsView rows={view} col={col} minSample={MIN_SAMPLE} />
      <p className="text-xs text-muted-foreground">
        {MIN_SAMPLE}&apos;ten az talebi olan satırların oranı soluk gösterilir, çünkü az veriyle oran yanıltıcı olabilir. Bekleyen: henüz aranmamış.
      </p>
    </>
  );
}

function LinkTabs({ label, value, items }: { label: string; value: string; items: { v: string; label: string; href: string }[] }) {
  return (
    <Tabs value={value}>
      <TabsList aria-label={label}>
        {items.map((i) => (
          <TabsTrigger key={i.v} value={i.v} asChild>
            <Link href={i.href} aria-current={value === i.v ? "page" : undefined}>
              {i.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function pct(a: number, b: number) {
  return b ? `%${Math.round((a / b) * 100)}` : "—";
}
