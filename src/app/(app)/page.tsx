import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, ProductChip, SourceChip } from "@/components/chips";
import { DashboardAlarms } from "@/components/dashboard-alarms";
import { StatCard as Stat, StatGrid } from "@/components/stat-card";
import { LeadTrendChart } from "@/components/lead-trend-chart";
import { RenewalBadge } from "@/components/renewal-badge";
import { EmptyText, SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIRST_RESPONSE_SLA_MIN, STAGES, productLabel, sourceLabel } from "@/lib/constants";
import { ago, fmtYmd, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { dashboard, leadTrend } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [d, trend] = await Promise.all([dashboard(), leadTrend(90)]);
  const sum = (pts: typeof trend) => pts.reduce((a, p) => a + p.meta + p.website + p.manual, 0);
  const last7 = sum(trend.slice(-7));
  const prev7 = sum(trend.slice(-14, -7));
  const weekDelta = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const avgDay = Math.round((sum(trend.slice(-31, -1)) / 30) * 10) / 10;
  const late = d.waiting.filter((r) => minutesSince(r.createdAt, d.now) > FIRST_RESPONSE_SLA_MIN).length;
  const stageCount = (c: string) => d.byStage.find((s) => s.stage === c)?.n ?? 0;
  const total30 = d.bySource.reduce((a, s) => a + s.total, 0);
  const won30 = d.bySource.reduce((a, s) => a + s.won, 0);

  return (
    <>
      <PageHeader title="Pano" sub="Bugün kimi aramak gerekiyor, hangi poliçeler yenilenecek, lead'ler nereden geliyor." />

      <StatGrid>
        <Stat label="Bugün gelen" value={d.today} foot={`Son 30 gün ortalaması günde ${avgDay}`} sub="Meta, web sitesi ve elle girilenler" />
        <Stat
          label="Son 7 gün"
          value={d.week}
          delta={weekDelta}
          foot={weekDelta == null ? "Önceki hafta veri yok" : weekDelta >= 0 ? "Önceki haftadan fazla" : "Önceki haftadan az"}
          sub={`Önceki 7 gün: ${prev7} talep`}
        />
        <Stat
          label="Dönüş bekleyen"
          value={d.waiting.length}
          alert={late > 0}
          foot={late > 0 ? `${late} tanesi ${FIRST_RESPONSE_SLA_MIN} dk'yı geçti` : "Hepsi süresi içinde"}
          sub="Henüz aranmamış yeni talepler"
        />
        <Stat
          label="Dönüşüm (30 gün)"
          value={total30 ? `%${Math.round((won30 / total30) * 100)}` : "—"}
          foot={`${won30} / ${total30} talep kazanıldı`}
          sub="Tüm kaynaklar"
        />
      </StatGrid>

      <LeadTrendChart data={trend} />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <SectionCard title="İlk dönüş bekleyenler" sub="En eski en üstte">
          {d.waiting.length === 0 ? (
            <EmptyText text="Bekleyen yeni talep yok. 🎉" />
          ) : (
            <ul className="divide-y">
              {d.waiting.map((r) => {
                const m = minutesSince(r.createdAt, d.now);
                const overdue = m > FIRST_RESPONSE_SLA_MIN;
                return (
                  <li key={r.id}>
                    <Link href={`/kisiler/${r.contactId}`} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
                      <span className={cn("size-2 shrink-0 rounded-full", overdue ? "animate-pulse bg-brand" : "bg-amber-400")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPhone(r.phone)}
                          {r.preferredCallTime && <> · arama: {r.preferredCallTime}</>}
                        </div>
                      </div>
                      <div className="hidden gap-1 sm:flex">
                        <ProductChip code={r.product} />
                        <SourceChip code={r.source} detail={r.sourceDetail} />
                      </div>
                      <span className={cn("w-20 text-right text-xs", overdue ? "font-semibold text-brand" : "text-muted-foreground")}>
                        {ago(r.createdAt, d.now)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Bugünkü alarmlar" sub="Gecikenler dahil">
          <DashboardAlarms alarms={d.alarms} />
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title="Yaklaşan yenilemeler"
          sub="Önümüzdeki 60 gün"
          action={
            <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
              <Link href="/musteriler?yenileme=90">
                Tümü <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          {d.renewals.length === 0 ? (
            <EmptyText text="Önümüzdeki 60 günde yenilenecek poliçe yok." />
          ) : (
            <ul className="grid divide-y md:grid-cols-2 md:divide-y-0">
              {d.renewals.map((p) => (
                <li key={p.id} className="md:border-b">
                  <Link href={`/kisiler/${p.contactId}`} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {productLabel(p.product)}
                        {p.insurer && ` · ${p.insurer}`} · {fmtYmd(p.endDate)}
                      </div>
                    </div>
                    <RenewalBadge ymd={p.endDate} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Kaynaklar" sub="Son 30 gün">
          {d.bySource.length === 0 ? (
            <EmptyText text="Henüz veri yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Kaynak</TableHead>
                  <TableHead className="text-right">Talep</TableHead>
                  <TableHead className="text-right">Ulaşılan</TableHead>
                  <TableHead className="text-right">Kazanılan</TableHead>
                  <TableHead className="pr-6 text-right">Ort. ilk dönüş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.bySource.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="pl-6 font-medium">{sourceLabel(s.source)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.contacted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.won} <span className="text-xs text-muted-foreground">(%{Math.round((s.won / s.total) * 100)})</span>
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{s.avgFirstResponseMin == null ? "—" : fmtMinutes(s.avgFirstResponseMin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-6 py-3 text-xs text-muted-foreground">
            {STAGES.map((s) => (
              <span key={s.code}>
                {s.label}: <b className="text-foreground tabular-nums">{stageCount(s.code)}</b>
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Son hareketler">
          {d.recent.length === 0 ? (
            <EmptyText text="Henüz hareket yok." />
          ) : (
            <ul className="divide-y">
              {d.recent.map((a) => (
                <li key={a.id} className="flex gap-3 px-6 py-2.5 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{ago(a.createdAt, d.now)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <Link href={`/kisiler/${a.contactId}`} className="font-medium hover:underline">
                      {a.fullName}
                    </Link>{" "}
                    <span className="text-muted-foreground">— {a.body}</span>
                  </span>
                  {a.userName && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{a.userName}</span>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} dk`;
  if (m < 1440) return `${(m / 60).toFixed(1)} sa`;
  return `${(m / 1440).toFixed(1)} gün`;
}
