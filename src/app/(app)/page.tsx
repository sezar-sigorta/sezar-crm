import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, ProductChip, SourceChip } from "@/components/chips";
import { DashboardAlarms } from "@/components/dashboard-alarms";
import { RenewalBadge } from "@/components/renewal-badge";
import { EmptyText, SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIRST_RESPONSE_SLA_MIN, STAGES, productLabel, sourceLabel } from "@/lib/constants";
import { ago, fmtYmd, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { dashboard } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const d = await dashboard();
  const late = d.waiting.filter((r) => minutesSince(r.createdAt, d.now) > FIRST_RESPONSE_SLA_MIN).length;
  const stageCount = (c: string) => d.byStage.find((s) => s.stage === c)?.n ?? 0;
  const total30 = d.bySource.reduce((a, s) => a + s.total, 0);
  const won30 = d.bySource.reduce((a, s) => a + s.won, 0);

  return (
    <>
      <PageHeader title="Pano" sub="Bugün kimi aramak gerekiyor, hangi poliçeler yenilenecek, lead'ler nereden geliyor." />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugün gelen" value={d.today} />
        <Stat label="Son 7 gün" value={d.week} />
        <Stat label="Dönüş bekleyen" value={d.waiting.length} alert={late > 0 ? `${late} tanesi ${FIRST_RESPONSE_SLA_MIN} dk'yı geçti` : undefined} />
        <Stat label="Dönüşüm (30 gün)" value={total30 ? `%${Math.round((won30 / total30) * 100)}` : "—"} hint={`${won30} / ${total30} talep`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="İlk dönüş bekleyenler" sub="— en eski en üstte">
          {d.waiting.length === 0 ? (
            <EmptyText text="Bekleyen yeni talep yok. 🎉" />
          ) : (
            <ul className="divide-y">
              {d.waiting.map((r) => {
                const m = minutesSince(r.createdAt, d.now);
                const overdue = m > FIRST_RESPONSE_SLA_MIN;
                return (
                  <li key={r.id}>
                    <Link href={`/kisiler/${r.contactId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
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
                      <span className={cn("w-20 text-right text-xs", overdue ? "font-semibold text-brand" : "text-muted-foreground")}>{ago(r.createdAt, d.now)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Bugünkü alarmlar" sub="— gecikenler dahil">
          <DashboardAlarms alarms={d.alarms} />
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title="Yaklaşan yenilemeler"
          sub="— 60 gün"
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
                  <Link href={`/kisiler/${p.contactId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
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

        <SectionCard title="Kaynaklar (son 30 gün)">
          {d.bySource.length === 0 ? (
            <EmptyText text="Henüz veri yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Kaynak</TableHead>
                  <TableHead className="text-right">Talep</TableHead>
                  <TableHead className="text-right">Ulaşılan</TableHead>
                  <TableHead className="text-right">Kazanılan</TableHead>
                  <TableHead className="pr-5 text-right">Ort. ilk dönüş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.bySource.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="pl-5 font-medium">{sourceLabel(s.source)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.contacted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.won} <span className="text-xs text-muted-foreground">(%{Math.round((s.won / s.total) * 100)})</span>
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{s.avgFirstResponseMin == null ? "—" : fmtMinutes(s.avgFirstResponseMin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
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
                <li key={a.id} className="flex gap-3 px-5 py-2.5 text-sm">
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

function Stat({ label, value, hint, alert }: { label: string; value: number | string; hint?: string; alert?: string }) {
  return (
    <Card size="sm" className={cn(alert && "ring-brand/40")}>
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-semibold text-foreground tabular-nums">{value}</div>
        {alert ? <div className="mt-0.5 text-xs font-medium text-brand">{alert}</div> : hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} dk`;
  if (m < 1440) return `${(m / 60).toFixed(1)} sa`;
  return `${(m / 1440).toFixed(1)} gün`;
}
