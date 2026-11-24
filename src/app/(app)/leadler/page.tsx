import Link from "next/link";
import { NameCell, PageHeader, ProductChip, StageChip } from "@/components/chips";
import { ConvertButton } from "@/components/convert-button";
import { SOURCES, STAGES, sourceLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { listLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Leadler({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rows = await listLeads({ q: sp.q, source: sp.kaynak, stage: sp.asama, kind: sp.tur });
  const now = new Date();
  const filtered = !!(sp.q || sp.kaynak || sp.asama || sp.tur);

  return (
    <>
      <PageHeader title="Leadler" sub="Henüz poliçe yaptırmamış potansiyel müşteriler. Poliçe kesilince “Müşteriye dönüştür”.">
        <Link href="/kisiler/yeni" className="btn-primary">
          + Yeni lead
        </Link>
      </PageHeader>

      <form role="search" className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="input max-w-64" aria-label="Ara" />
        <select name="kaynak" defaultValue={sp.kaynak ?? ""} className="input w-auto" aria-label="Kanal">
          <option value="">Tüm kanallar</option>
          {SOURCES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="tur" defaultValue={sp.tur ?? ""} className="input w-auto" aria-label="Tür">
          <option value="">Bireysel + kurumsal</option>
          <option value="bireysel">Bireysel</option>
          <option value="kurumsal">Kurumsal</option>
        </select>
        <select name="asama" defaultValue={sp.asama ?? ""} className="input w-auto" aria-label="Durum">
          <option value="">Tüm durumlar</option>
          {STAGES.filter((s) => s.code !== "won").map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn-ghost">Filtrele</button>
        {filtered && (
          <Link href="/leadler" className="btn-ghost">
            Temizle
          </Link>
        )}
        <span className="ml-auto self-center text-sm text-ink-2">{rows.length} lead</span>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-3 py-2.5 font-medium">Telefon / e-posta</th>
              <th className="px-3 py-2.5 font-medium">Kanal</th>
              <th className="px-3 py-2.5 font-medium">İlgilendiği poliçeler</th>
              <th className="px-3 py-2.5 font-medium">Durum</th>
              <th className="px-3 py-2.5 font-medium">Alarm</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-cream-l">
                <td className="px-4 py-2.5">
                  <NameCell c={c} href={`/kisiler/${c.id}`} sub={<div className="text-xs text-ink-2">{ago(c.lastAt ?? c.createdAt, now)}</div>} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="whitespace-nowrap tabular-nums">{formatPhone(c.phone)}</div>
                  {c.email && <div className="max-w-48 truncate text-xs text-ink-2">{c.email}</div>}
                </td>
                <td className="px-3 py-2.5 text-ink-2">{(c.sources ?? []).map(sourceLabel).join(", ") || "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(c.products ?? []).map((p) => (
                      <ProductChip key={p} code={p} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">{c.stage ? <StageChip code={c.stage} /> : "—"}</td>
                <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${c.nextAlarmAt && c.nextAlarmAt < now ? "font-semibold text-accent" : "text-ink-2"}`}>
                  {c.nextAlarmAt ? `⏰ ${fmtDateTime(c.nextAlarmAt)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ConvertButton contactId={c.id} name={c.fullName} defaultProduct={c.products?.[0]} size="sm" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-2">
                  Lead bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
