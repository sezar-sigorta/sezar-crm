import Link from "next/link";
import { PageHeader, ProductChip } from "@/components/chips";
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
        <nav className="flex rounded-lg border border-line bg-white p-0.5" aria-label="Gruplama">
          {GROUPS.map((g) => (
            <Link
              key={g.v}
              href={`/raporlar${qs({ grup: g.v })}`}
              aria-current={group === g.v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${group === g.v ? "bg-navy text-cream" : "text-ink-2 hover:text-navy"}`}
            >
              {g.label}
            </Link>
          ))}
        </nav>
        <nav className="flex rounded-lg border border-line bg-white p-0.5" aria-label="Dönem">
          {PERIODS.map((p) => (
            <Link
              key={p.v}
              href={`/raporlar${qs({ donem: p.v })}`}
              aria-current={period === p.v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${period === p.v ? "bg-navy text-cream" : "text-ink-2 hover:text-navy"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
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

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">{col}</th>
              <th className="px-3 py-2.5 font-medium">Ürün</th>
              <th className="px-3 py-2.5 text-right font-medium">Talep</th>
              <th className="px-3 py-2.5 text-right font-medium">Ulaşılan</th>
              <th className="px-3 py-2.5 text-right font-medium">Kazanılan</th>
              <th className="w-40 px-3 py-2.5 font-medium">Dönüşüm</th>
              <th className="px-3 py-2.5 text-right font-medium">Ort. ilk dönüş</th>
              <th className="px-3 py-2.5 text-right font-medium">Bekleyen</th>
              <th className="px-4 py-2.5 font-medium">En sık kayıp nedeni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const name = formLabel(r.key);
              const href = r.key
                ? `/talepler?${new URLSearchParams(group === "form" ? { form: r.key } : { kampanya: group === "ad" ? (r.parent ?? "") : r.key })}`
                : `/talepler?${new URLSearchParams({ kaynak: channelOf(r.source) })}`;
              const rate = r.total ? r.won / r.total : 0;
              const few = r.total < MIN_SAMPLE;
              return (
                <tr key={`${r.source}|${r.parent}|${r.key}`} className="hover:bg-cream-l">
                  <td className="px-4 py-2.5">
                    <Link href={href} className="font-medium hover:underline">
                      {name ?? <span className="text-ink-2">{r.source === "meta" || r.source === "website" ? `(${col.toLocaleLowerCase("tr")} bilgisi yok)` : "Elle eklenenler"}</span>}
                    </Link>
                    <div className="text-xs text-ink-2">
                      {sourceLabel(r.source)}
                      {r.parent && ` · ${r.parent}`} · {fmtDate(r.first)}
                      {r.first.toDateString() !== r.last.toDateString() && ` – ${fmtDate(r.last)}`}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.products.slice(0, 3).map((p) => (
                        <ProductChip key={p} code={p} />
                      ))}
                      {r.products.length > 3 && <span className="text-xs text-ink-2">+{r.products.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{r.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.reached}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.won}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2" title={few ? "Az veri: oran henüz güvenilir değil" : undefined}>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream" aria-hidden>
                        <div className={`h-full rounded-full ${few ? "bg-navy-l" : "bg-emerald-600"}`} style={{ width: `${(rate / maxRate) * 100}%` }} />
                      </div>
                      <span className={`w-10 text-right text-xs tabular-nums ${few ? "text-ink-2" : "font-medium"}`}>%{Math.round(rate * 100)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{r.avgFirstResponseMin == null ? "—" : fmtMinutes(r.avgFirstResponseMin)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${r.waiting ? "font-medium text-brand" : "text-ink-2"}`}>{r.waiting || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-2">{r.topLostReason ? `${r.topLostReason} (${r.lost} kayıp)` : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-2">
                  Bu dönemde talep yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-2">
        Satıra tıklayınca o {col.toLocaleLowerCase("tr")}dan gelen talepler açılır. {MIN_SAMPLE}'ten az talebi olan satırların oranı soluk gösterilir, çünkü az veriyle oran yanıltıcı olabilir. Bekleyen: henüz aranmamış.
      </p>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-navy">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-2">{hint}</div>}
    </div>
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
