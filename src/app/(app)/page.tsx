import Link from "next/link";
import { PageHeader, ProductChip, SourceChip } from "@/components/chips";
import { DashboardAlarms } from "@/components/dashboard-alarms";
import { RenewalBadge } from "@/components/renewal-badge";
import { FIRST_RESPONSE_SLA_MIN, STAGES, productLabel, sourceLabel } from "@/lib/constants";
import { ago, fmtYmd, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { dashboard } from "@/lib/queries";

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
        <section className="card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-base font-semibold">
            İlk dönüş bekleyenler
            <span className="text-xs font-normal text-ink-2">— en eski en üstte</span>
          </h2>
          {d.waiting.length === 0 ? (
            <Empty text="Bekleyen yeni talep yok. 🎉" />
          ) : (
            <ul className="divide-y divide-line">
              {d.waiting.map((r) => {
                const m = minutesSince(r.createdAt, d.now);
                const overdue = m > FIRST_RESPONSE_SLA_MIN;
                return (
                  <li key={r.id}>
                    <Link href={`/kisiler/${r.contactId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-l">
                      <span className={`size-2 shrink-0 rounded-full ${overdue ? "bg-brand animate-pulse" : "bg-amber-400"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.fullName}</div>
                        <div className="text-xs text-ink-2">
                          {formatPhone(r.phone)}
                          {r.preferredCallTime && <> · arama: {r.preferredCallTime}</>}
                        </div>
                      </div>
                      <div className="hidden gap-1 sm:flex">
                        <ProductChip code={r.product} />
                        <SourceChip code={r.source} detail={r.sourceDetail} />
                      </div>
                      <span className={`w-20 text-right text-xs ${overdue ? "font-semibold text-brand" : "text-ink-2"}`}>{ago(r.createdAt, d.now)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-base font-semibold">
            Bugünkü alarmlar
            <span className="text-xs font-normal text-ink-2">— gecikenler dahil</span>
          </h2>
          <DashboardAlarms alarms={d.alarms} />
        </section>

        <section className="card overflow-hidden xl:col-span-2">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-base font-semibold">
            Yaklaşan yenilemeler
            <span className="text-xs font-normal text-ink-2">— 60 gün</span>
            <Link href="/musteriler?yenileme=90" className="ml-auto text-xs font-normal text-ink-2 hover:text-navy">
              Tümü →
            </Link>
          </h2>
          {d.renewals.length === 0 ? (
            <Empty text="Önümüzdeki 60 günde yenilenecek poliçe yok." />
          ) : (
            <ul className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0">
              {d.renewals.map((p) => (
                <li key={p.id} className="md:border-b md:border-line">
                  <Link href={`/kisiler/${p.contactId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-l">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.fullName}</div>
                      <div className="truncate text-xs text-ink-2">
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
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 text-base font-semibold">Kaynaklar (son 30 gün)</h2>
          {d.bySource.length === 0 ? (
            <Empty text="Henüz veri yok." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-2">
                  <tr>
                    <th className="px-5 py-2 font-medium">Kaynak</th>
                    <th className="px-3 py-2 text-right font-medium">Talep</th>
                    <th className="px-3 py-2 text-right font-medium">Ulaşılan</th>
                    <th className="px-3 py-2 text-right font-medium">Kazanılan</th>
                    <th className="px-5 py-2 text-right font-medium">Ort. ilk dönüş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.bySource.map((s) => (
                    <tr key={s.source}>
                      <td className="px-5 py-2.5 font-medium">{sourceLabel(s.source)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.total}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.contacted}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {s.won} <span className="text-xs text-ink-2">(%{Math.round((s.won / s.total) * 100)})</span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{s.avgFirstResponseMin == null ? "—" : fmtMinutes(s.avgFirstResponseMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-ink-2">
            {STAGES.map((s) => (
              <span key={s.code}>
                {s.label}: <b className="text-navy tabular-nums">{stageCount(s.code)}</b>
              </span>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 text-base font-semibold">Son hareketler</h2>
          {d.recent.length === 0 ? (
            <Empty text="Henüz hareket yok." />
          ) : (
            <ul className="divide-y divide-line">
              {d.recent.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-2.5 text-sm">
                  <span className="w-16 shrink-0 text-xs text-ink-2">{ago(a.createdAt, d.now)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <Link href={`/kisiler/${a.contactId}`} className="font-medium hover:underline">
                      {a.fullName}
                    </Link>{" "}
                    <span className="text-ink-2">— {a.body}</span>
                  </span>
                  {a.userName && <span className="hidden shrink-0 text-xs text-ink-2 sm:inline">{a.userName}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, hint, alert }: { label: string; value: number | string; hint?: string; alert?: string }) {
  return (
    <div className={`card px-4 py-3.5 ${alert ? "border-brand/40" : ""}`}>
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-navy">{value}</div>
      {alert ? <div className="mt-0.5 text-xs font-medium text-brand">{alert}</div> : hint && <div className="mt-0.5 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-2">{text}</p>;
}

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} dk`;
  if (m < 1440) return `${(m / 60).toFixed(1)} sa`;
  return `${(m / 1440).toFixed(1)} gün`;
}
