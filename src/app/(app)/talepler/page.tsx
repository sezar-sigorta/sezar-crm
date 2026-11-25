import Link from "next/link";
import { PageHeader } from "@/components/chips";
import { Kanban } from "@/components/kanban";
import { LeadDrawer } from "@/components/lead-drawer";
import { LeadTable } from "@/components/lead-table";
import { FIRST_RESPONSE_SLA_MIN, LEAD_CHANNELS, PRODUCTS, channelOf, formLabel } from "@/lib/constants";
import { formAndCampaignNames, leadDetail, listUsers, pipeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

/**
 * Lead Merkezi: every request from Meta lead forms and the website forms in one place,
 * as a pipeline (Ardışık görünüm) or a table (Tablo görünümü), with a side panel per lead.
 */
export default async function Talepler({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = sp.gorunum === "tablo" ? "tablo" : "ardisik";
  // The source tab is applied in memory so every tab can show its count.
  const [all, team, names, detail] = await Promise.all([
    pipeline({ q: sp.q, product: sp.urun, assignee: sp.sorumlu, form: sp.form, campaign: sp.kampanya }),
    listUsers(),
    formAndCampaignNames(),
    sp.lead ? leadDetail(sp.lead) : null,
  ]);
  const channel = LEAD_CHANNELS.some((c) => c.code === sp.kaynak) ? (sp.kaynak ?? "") : "";
  const rows = channel ? all.filter((r) => channelOf(r.source) === channel) : all;
  const filtered = !!(sp.q || sp.urun || sp.sorumlu || sp.form || sp.kampanya);

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/talepler?${s}` : "/talepler";
  };

  // Funnel numbers for the current tab (open leads + those closed in the last 30 days).
  const waiting = rows.filter((r) => r.stage === "new");
  const late = waiting.filter((r) => Date.now() - new Date(r.createdAt).getTime() > FIRST_RESPONSE_SLA_MIN * 60000).length;
  const won = rows.filter((r) => r.stage === "won").length;
  const closed = won + rows.filter((r) => r.stage === "lost").length;
  const unassigned = rows.filter((r) => !r.assignedTo && r.stage !== "won" && r.stage !== "lost").length;

  return (
    <>
      <PageHeader title="Lead Merkezi" sub="Meta reklam formları ve web sitesi formlarından gelen tüm talepler.">
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="group" aria-label="Görünüm">
          <Link href={href({ gorunum: null })} aria-current={view === "ardisik" ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm ${view === "ardisik" ? "bg-navy text-cream" : "text-navy hover:bg-cream"}`}>
            Ardışık görünüm
          </Link>
          <Link href={href({ gorunum: "tablo" })} aria-current={view === "tablo" ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm ${view === "tablo" ? "bg-navy text-cream" : "text-navy hover:bg-cream"}`}>
            Tablo görünümü
          </Link>
        </div>
        <Link href="/kisiler/yeni" className="btn-primary">
          + Lead ekle
        </Link>
      </PageHeader>

      <nav aria-label="Kaynak" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {LEAD_CHANNELS.map((c) => {
          const n = c.code ? all.filter((r) => channelOf(r.source) === c.code).length : all.length;
          const on = channel === c.code;
          return (
            <Link
              key={c.code || "all"}
              href={href({ kaynak: c.code || null, lead: null })}
              aria-current={on ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${on ? "border-navy font-semibold text-navy" : "border-transparent text-ink-2 hover:text-navy"}`}
            >
              {c.label}
              <span className="rounded-full bg-cream px-1.5 text-xs tabular-nums">{n}</span>
            </Link>
          );
        })}
      </nav>

      <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Yanıt bekleyen" value={waiting.length} hint={late ? `${late} tanesi ${FIRST_RESPONSE_SLA_MIN} dk'yı geçti` : "Hepsi süresinde"} warn={late > 0} />
        <Stat label="Atanmamış açık lead" value={unassigned} />
        <Stat label="Kazanılan (30 gün)" value={won} />
        <Stat label="Dönüşüm oranı" value={closed ? `%${Math.round((won / closed) * 100)}` : "—"} hint="Kapanan talepler içinde" />
      </dl>

      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        {channel && <input type="hidden" name="kaynak" value={channel} />}
        {view === "tablo" && <input type="hidden" name="gorunum" value="tablo" />}
        <input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="input max-w-64" aria-label="Ara" />
        <select name="urun" defaultValue={sp.urun ?? ""} className="input w-auto" aria-label="Sigorta türü">
          <option value="">Tüm ürünler</option>
          {PRODUCTS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <select name="sorumlu" defaultValue={sp.sorumlu ?? ""} className="input w-auto" aria-label="Atanan">
          <option value="">Herkes</option>
          <option value="none">Atanmamış</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select name="form" defaultValue={sp.form ?? ""} className="input w-auto max-w-56" aria-label="Form">
          <option value="">Tüm formlar</option>
          {names.forms.map((f) => (
            <option key={f} value={f}>
              {formLabel(f)}
            </option>
          ))}
        </select>
        {channel !== "website" && (
          <select name="kampanya" defaultValue={sp.kampanya ?? ""} className="input w-auto max-w-56" aria-label="Kampanya">
            <option value="">Tüm kampanyalar</option>
            {names.campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <button className="btn-primary">Filtrele</button>
        {filtered && (
          <Link href={href({ q: null, urun: null, sorumlu: null, form: null, kampanya: null, lead: null })} className="btn-ghost">
            Temizle
          </Link>
        )}
      </form>

      {view === "tablo" ? <LeadTable rows={rows} team={team} selected={sp.lead} /> : <Kanban rows={rows} team={team} />}

      {detail && (
        <>
          <Link href={href({ lead: null })} scroll={false} aria-label="Paneli kapat" className="fixed inset-0 z-30 bg-navy/20" />
          <LeadDrawer key={detail.request.id} detail={detail} team={team} closeHref={href({ lead: null })} />
        </>
      )}
    </>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number | string; hint?: string; warn?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-navy">{value}</dd>
      {hint && <dd className={`text-xs ${warn ? "font-semibold text-brand" : "text-ink-2"}`}>{hint}</dd>}
    </div>
  );
}
