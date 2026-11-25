import Link from "next/link";
import { PageHeader, ProductChip } from "@/components/chips";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
  const maxRate = Math.max(0.0001, ...rows.map((r) => (r.total ? r.won / r.total : 0)));

  return (
    <>
      <PageHeader title="Raporlar" sub="Hangi form, kampanya ve reklam lead getiriyor, hangisi satışa dönüyor." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <LinkTabs label="Gruplama" value={group} items={GROUPS.map((g) => ({ v: g.v, label: g.label, href: `/raporlar${qs({ grup: g.v })}` }))} />
        <LinkTabs label="Dönem" value={period} items={PERIODS.map((p) => ({ v: p.v, label: p.label, href: `/raporlar${qs({ donem: p.v })}` }))} />
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam talep" value={String(total)} />
        <Stat label="Ulaşılan" value={pct(reached, total)} hint={`${reached} talep`} />
        <Stat label="Kazanılan" value={pct(won, total)} hint={`${won} talep`} />
        <Stat
          label={`En iyi dönüşen ${col.toLocaleLowerCase("tr")}`}
          value={best ? pct(best.won, best.total) : "—"}
          hint={best ? (formLabel(best.key) ?? "") : `En az ${MIN_SAMPLE} talebi olanlar arasında`}
        />
      </section>

      <Card className="py-0">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-64 pl-4">{col}</TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead className="text-right">Talep</TableHead>
              <TableHead className="text-right">Ulaşılan</TableHead>
              <TableHead className="text-right">Kazanılan</TableHead>
              <TableHead className="w-40">Dönüşüm</TableHead>
              <TableHead className="text-right">Ort. ilk dönüş</TableHead>
              <TableHead className="text-right">Bekleyen</TableHead>
              <TableHead className="pr-4">En sık kayıp nedeni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const name = formLabel(r.key);
              const href = r.key
                ? `/talepler?${new URLSearchParams(group === "form" ? { form: r.key } : { kampanya: group === "ad" ? (r.parent ?? "") : r.key })}`
                : `/talepler?${new URLSearchParams({ kaynak: channelOf(r.source) })}`;
              const rate = r.total ? r.won / r.total : 0;
              const few = r.total < MIN_SAMPLE;
              const bar = (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <div className={cn("h-full rounded-full", few ? "bg-navy-l" : "bg-emerald-600")} style={{ width: `${(rate / maxRate) * 100}%` }} />
                  </div>
                  <span className={cn("w-10 text-right text-xs tabular-nums", few ? "text-muted-foreground" : "font-medium")}>%{Math.round(rate * 100)}</span>
                </div>
              );
              return (
                <TableRow key={`${r.source}|${r.parent}|${r.key}`}>
                  <TableCell className="pl-4 whitespace-normal">
                    <Link href={href} className="font-medium hover:underline">
                      {name ?? <span className="text-muted-foreground">{r.source === "meta" || r.source === "website" ? `(${col.toLocaleLowerCase("tr")} bilgisi yok)` : "Elle eklenenler"}</span>}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {sourceLabel(r.source)}
                      {r.parent && ` · ${r.parent}`} · {fmtDate(r.first)}
                      {r.first.toDateString() !== r.last.toDateString() && ` – ${fmtDate(r.last)}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.products.slice(0, 3).map((p) => (
                        <ProductChip key={p} code={p} />
                      ))}
                      {r.products.length > 3 && <span className="text-xs text-muted-foreground">+{r.products.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{r.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.reached}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell>
                    {few ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent>Az veri: oran henüz güvenilir değil</TooltipContent>
                      </Tooltip>
                    ) : (
                      bar
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.avgFirstResponseMin == null ? "—" : fmtMinutes(r.avgFirstResponseMin)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.waiting ? "font-medium text-brand" : "text-muted-foreground")}>{r.waiting || "—"}</TableCell>
                  <TableCell className="pr-4 text-xs whitespace-normal text-muted-foreground">{r.topLostReason ? `${r.topLostReason} (${r.lost} kayıp)` : "—"}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Bu dönemde talep yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Satıra tıklayınca o {col.toLocaleLowerCase("tr")}dan gelen talepler açılır. {MIN_SAMPLE}'ten az talebi olan satırların oranı soluk gösterilir, çünkü az veriyle oran yanıltıcı olabilir. Bekleyen: henüz aranmamış.
      </p>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-semibold text-foreground tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
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

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} dk`;
  if (m < 1440) return `${(m / 60).toFixed(1)} sa`;
  return `${(m / 1440).toFixed(1)} gün`;
}
