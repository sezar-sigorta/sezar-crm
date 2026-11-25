import Link from "next/link";
import { NameCell, PageHeader, ProductChip } from "@/components/chips";
import { RenewalBadge } from "@/components/renewal-badge";
import { durationSince, fmtDateTime, fmtYmd } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { v: "", label: "Hepsi" },
  { v: "30", label: "30 gün içinde yenilenecek" },
  { v: "90", label: "90 gün içinde" },
];

export default async function Musteriler({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rows = await listCustomers({ q: sp.q, renewal: sp.yenileme, kind: sp.tur });
  const now = new Date();
  const qs = (v: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (v) p.set("yenileme", v);
    if (sp.tur) p.set("tur", sp.tur);
    return p.size ? `?${p}` : "";
  };

  return (
    <>
      <PageHeader title="Müşteriler" sub="Poliçesi olan kişi ve şirketler. En yakın yenilemesi olan en üstte.">
        <Link href="/kisiler/yeni?tur=musteri" className="btn-primary">
          + Yeni müşteri
        </Link>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap rounded-lg border border-line bg-white p-0.5" aria-label="Yenileme filtresi">
          {TABS.map((t) => (
            <Link
              key={t.v}
              href={`/musteriler${qs(t.v)}`}
              aria-current={(sp.yenileme ?? "") === t.v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${(sp.yenileme ?? "") === t.v ? "bg-navy text-cream" : "text-ink-2 hover:text-navy"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2">
          {sp.yenileme && <input type="hidden" name="yenileme" value={sp.yenileme} />}
          <select name="tur" defaultValue={sp.tur ?? ""} className="input w-auto" aria-label="Tür">
            <option value="">Bireysel + kurumsal</option>
            <option value="bireysel">Bireysel</option>
            <option value="kurumsal">Kurumsal</option>
          </select>
          <input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="input w-64" aria-label="Ara" />
          <button className="btn-ghost">Ara</button>
        </form>
        <span className="ml-auto text-sm text-ink-2">{rows.length} müşteri</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Müşteri</th>
              <th className="px-3 py-2.5 font-medium">Telefon / e-posta</th>
              <th className="px-3 py-2.5 font-medium">Müşteri süresi</th>
              <th className="px-3 py-2.5 font-medium">Poliçeler</th>
              <th className="px-3 py-2.5 font-medium">Sonraki yenileme</th>
              <th className="px-4 py-2.5 font-medium">Alarm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-cream-l">
                <td className="px-4 py-2.5">
                  <NameCell c={c} href={`/kisiler/${c.id}`} sub={c.city && c.kind !== "kurumsal" ? <div className="text-xs text-ink-2">{c.city}</div> : null} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="whitespace-nowrap tabular-nums">{formatPhone(c.phone)}</div>
                  {c.email && <div className="max-w-48 truncate text-xs text-ink-2">{c.email}</div>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{durationSince(c.customerSince, now)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(c.products ?? []).map((p) => (
                      <ProductChip key={p} code={p} />
                    ))}
                    {!c.activeCount && <span className="text-xs text-brand">Poliçe girilmemiş</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {c.nextRenewal ? (
                    <div className="flex items-center gap-2">
                      {fmtYmd(c.nextRenewal)} <RenewalBadge ymd={c.nextRenewal} />
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`px-4 py-2.5 text-xs whitespace-nowrap ${c.nextAlarmAt && c.nextAlarmAt < now ? "font-semibold text-brand" : "text-ink-2"}`}>
                  {c.nextAlarmAt ? `⏰ ${fmtDateTime(c.nextAlarmAt)}` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-2">
                  {sp.yenileme ? "Bu aralıkta yenilenecek poliçe yok." : "Henüz müşteri yok. Leadler sayfasından “Müşteriye dönüştür” ile ekleyin."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
