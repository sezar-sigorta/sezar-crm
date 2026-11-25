import { ListFilterIcon, PlusIcon, SearchIcon, SquareKanbanIcon, TableIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/chips";
import { FilterSelect } from "@/components/filter-select";
import { Kanban } from "@/components/kanban";
import { LeadDrawer } from "@/components/lead-drawer";
import { LeadTable } from "@/components/lead-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FIRST_RESPONSE_SLA_MIN, LEAD_CHANNELS, PRODUCTS, channelOf, formLabel } from "@/lib/constants";
import { formAndCampaignNames, leadDetail, listUsers, pipeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** "Tümü" value of the filter selects (Radix Select items can't use ""). */
const ALL = "all";

type SP = Promise<Record<string, string | undefined>>;

/**
 * Lead Merkezi: every request from Meta lead forms and the website forms in one place,
 * as a pipeline (Ardışık görünüm) or a table (Tablo görünümü), with a side panel per lead.
 */
export default async function Talepler({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  // The filter selects submit ALL for "Tümü" (Radix Select can't hold ""): drop it like an empty value.
  const sp = Object.fromEntries(Object.entries(raw).filter(([, v]) => v && v !== ALL)) as Record<string, string | undefined>;
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

  const viewItem = "h-8 px-3 data-[state=on]:bg-muted data-[state=on]:text-foreground";

  return (
    <>
      <PageHeader title="Lead Merkezi" sub="Meta reklam formları ve web sitesi formlarından gelen tüm talepler.">
        <Button asChild>
          <Link href="/kisiler/yeni">
            <PlusIcon data-icon="inline-start" />
            Lead ekle
          </Link>
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard
          label="Yanıt bekleyen"
          value={waiting.length}
          foot={late ? `${late} tanesi ${FIRST_RESPONSE_SLA_MIN} dk'yı geçti` : "Hepsi süresinde"}
          sub="Henüz aranmamış talepler"
          alert={late > 0}
        />
        <StatCard label="Atanmamış açık lead" value={unassigned} foot={unassigned ? "Sorumlu bekliyor" : "Hepsinin sorumlusu var"} sub="Açık talepler içinde" />
        <StatCard label="Kazanılan" value={won} foot="Poliçeye dönen talepler" sub="Son 30 gün" />
        <StatCard label="Dönüşüm oranı" value={closed ? `%${Math.round((won / closed) * 100)}` : "—"} foot={`${won} / ${closed} kapanan talep`} sub="Kazanılan / kapanan" />
      </StatGrid>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={channel || "all"} className="max-w-full overflow-x-auto">
            <TabsList aria-label="Kaynak">
              {LEAD_CHANNELS.map((c) => {
                const n = c.code ? all.filter((r) => channelOf(r.source) === c.code).length : all.length;
                return (
                  <TabsTrigger key={c.code || "all"} value={c.code || "all"} asChild>
                    <Link href={href({ kaynak: c.code || null, lead: null })} aria-current={channel === c.code ? "page" : undefined}>
                      {c.label}
                      <Badge variant="secondary" className="tabular-nums">
                        {n}
                      </Badge>
                    </Link>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <ToggleGroup type="single" value={view} variant="outline" size="sm" spacing={0} aria-label="Görünüm">
            <ToggleGroupItem value="ardisik" asChild className={viewItem}>
              <Link href={href({ gorunum: null })} aria-current={view === "ardisik" ? "page" : undefined}>
                <SquareKanbanIcon data-icon="inline-start" />
                Pano<span className="sr-only"> görünümü</span>
              </Link>
            </ToggleGroupItem>
            <ToggleGroupItem value="tablo" asChild className={viewItem}>
              <Link href={href({ gorunum: "tablo" })} aria-current={view === "tablo" ? "page" : undefined}>
                <TableIcon data-icon="inline-start" />
                Tablo<span className="sr-only"> görünümü</span>
              </Link>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <form className="flex flex-wrap items-center gap-2" role="search">
          {channel && <input type="hidden" name="kaynak" value={channel} />}
          {view === "tablo" && <input type="hidden" name="gorunum" value="tablo" />}
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="h-8 pl-8" aria-label="Ara" />
          </div>
          <FilterSelect size="sm" name="urun" label="Sigorta türü" defaultValue={sp.urun} allLabel="Tüm ürünler" options={PRODUCTS.map((p) => ({ value: p.code, label: p.label }))} />
          <FilterSelect
            size="sm"
            name="sorumlu"
            label="Atanan"
            defaultValue={sp.sorumlu}
            allLabel="Herkes"
            options={[{ value: "none", label: "Atanmamış" }, ...team.map((u) => ({ value: u.id, label: u.name }))]}
          />
          <FilterSelect size="sm" name="form" label="Form" defaultValue={sp.form} allLabel="Tüm formlar" className="max-w-56" options={names.forms.map((f) => ({ value: f, label: formLabel(f) ?? f }))} />
          {channel !== "website" && (
            <FilterSelect size="sm" name="kampanya" label="Kampanya" defaultValue={sp.kampanya} allLabel="Tüm kampanyalar" className="max-w-56" options={names.campaigns.map((c) => ({ value: c, label: c }))} />
          )}
          <Button type="submit" variant="outline" size="sm">
            <ListFilterIcon data-icon="inline-start" />
            Filtrele
          </Button>
          {filtered && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={href({ q: null, urun: null, sorumlu: null, form: null, kampanya: null, lead: null })}>
                <XIcon data-icon="inline-start" />
                Temizle
              </Link>
            </Button>
          )}
        </form>
      </div>

      {view === "tablo" ? <LeadTable rows={rows} team={team} selected={sp.lead} /> : <Kanban rows={rows} team={team} />}

      {detail && <LeadDrawer key={detail.request.id} detail={detail} team={team} closeHref={href({ lead: null })} />}
    </>
  );
}
