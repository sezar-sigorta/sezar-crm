import { PageHeader } from "@/components/chips";
import { Kanban } from "@/components/kanban";
import { PRODUCTS, SOURCES, formLabel } from "@/lib/constants";
import { formAndCampaignNames, listUsers, pipeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function Talepler({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [rows, team, names] = await Promise.all([
    pipeline({ q: sp.q, product: sp.urun, source: sp.kaynak, assignee: sp.sorumlu, form: sp.form, campaign: sp.kampanya }),
    listUsers(),
    formAndCampaignNames(),
  ]);
  const filtered = !!(sp.q || sp.urun || sp.kaynak || sp.sorumlu || sp.form || sp.kampanya);

  return (
    <>
      <PageHeader title="Talepler" sub="Kartı sürükleyerek aşamasını değiştirin. Kazanılan / kaybedilenler 30 gün görünür." />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="input max-w-64" aria-label="Ara" />
        <select name="urun" defaultValue={sp.urun ?? ""} className="input w-auto" aria-label="Sigorta türü">
          <option value="">Tüm ürünler</option>
          {PRODUCTS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <select name="kaynak" defaultValue={sp.kaynak ?? ""} className="input w-auto" aria-label="Kaynak">
          <option value="">Tüm kaynaklar</option>
          {SOURCES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="sorumlu" defaultValue={sp.sorumlu ?? ""} className="input w-auto" aria-label="Sorumlu">
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
        <select name="kampanya" defaultValue={sp.kampanya ?? ""} className="input w-auto max-w-56" aria-label="Kampanya">
          <option value="">Tüm kampanyalar</option>
          {names.campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn-primary">Filtrele</button>
        {filtered && (
          <a href="/talepler" className="btn-ghost">
            Temizle
          </a>
        )}
      </form>
      <Kanban rows={rows} team={team} />
    </>
  );
}
