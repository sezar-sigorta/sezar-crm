import { SquareKanbanIcon, PlusIcon, SearchIcon, TableIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/chips";
import { Kanban } from "@/components/kanban";
import { LeadDrawer } from "@/components/lead-drawer";
import { LeadTable } from "@/components/lead-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const selectCls = "h-8 w-auto bg-card";

  return (
    <>
      <PageHeader title="Lead Merkezi" sub="Meta reklam formları ve web sitesi formlarından gelen tüm talepler.">
        <ToggleGroup type="single" value={view} variant="outline" spacing={0} aria-label="Görünüm" className="bg-card">
          <ToggleGroupItem value="ardisik" asChild className={toggleOn}>
            <Link href={href({ gorunum: null })} aria-current={view === "ardisik" ? "page" : undefined}>
              <SquareKanbanIcon data-icon="inline-start" />
              Ardışık<span className="hidden sm:inline"> görünüm</span>
            </Link>
          </ToggleGroupItem>
          <ToggleGroupItem value="tablo" asChild className={toggleOn}>
            <Link href={href({ gorunum: "tablo" })} aria-current={view === "tablo" ? "page" : undefined}>
              <TableIcon data-icon="inline-start" />
              Tablo<span className="hidden sm:inline"> görünümü</span>
            </Link>
          </ToggleGroupItem>
        </ToggleGroup>
        <Button asChild>
          <Link href="/kisiler/yeni">
            <PlusIcon data-icon="inline-start" />
            Lead ekle
          </Link>
        </Button>
      </PageHeader>

      <Tabs value={channel || "all"}>
        <nav aria-label="Kaynak" className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
          <TabsList variant="line" className="h-auto! gap-1 p-0">
            {LEAD_CHANNELS.map((c) => {
              const n = c.code ? all.filter((r) => channelOf(r.source) === c.code).length : all.length;
              const on = channel === c.code;
              return (
                <TabsTrigger key={c.code || "all"} value={c.code || "all"} asChild className="h-10 flex-none px-3 group-data-horizontal/tabs:after:bottom-[-1px] after:bg-navy data-active:font-semibold data-active:text-navy">
                  <Link href={href({ kaynak: c.code || null, lead: null })} aria-current={on ? "page" : undefined}>
                    {c.label}
                    <Badge variant="secondary" className="h-4.5 px-1.5 tabular-nums">
                      {n}
                    </Badge>
                  </Link>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </nav>
      </Tabs>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Yanıt bekleyen" value={waiting.length} hint={late ? `${late} tanesi ${FIRST_RESPONSE_SLA_MIN} dk'yı geçti` : "Hepsi süresinde"} warn={late > 0} />
        <Stat label="Atanmamış açık lead" value={unassigned} />
        <Stat label="Kazanılan (30 gün)" value={won} />
        <Stat label="Dönüşüm oranı" value={closed ? `%${Math.round((won / closed) * 100)}` : "—"} hint="Kapanan talepler içinde" />
      </dl>

      <form className="flex flex-wrap items-end gap-2" role="search">
        {channel && <input type="hidden" name="kaynak" value={channel} />}
        {view === "tablo" && <input type="hidden" name="gorunum" value="tablo" />}
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="bg-card pl-8" aria-label="Ara" />
        </div>
        <Select name="urun" defaultValue={sp.urun ?? ALL}>
          <SelectTrigger aria-label="Sigorta türü" className={selectCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>Tüm ürünler</SelectItem>
            {PRODUCTS.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sorumlu" defaultValue={sp.sorumlu ?? ALL}>
          <SelectTrigger aria-label="Atanan" className={selectCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>Herkes</SelectItem>
            <SelectItem value="none">Atanmamış</SelectItem>
            {team.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="form" defaultValue={sp.form ?? ALL}>
          <SelectTrigger aria-label="Form" className={`${selectCls} max-w-56`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>Tüm formlar</SelectItem>
            {names.forms.map((f) => (
              <SelectItem key={f} value={f}>
                {formLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {channel !== "website" && (
          <Select name="kampanya" defaultValue={sp.kampanya ?? ALL}>
            <SelectTrigger aria-label="Kampanya" className={`${selectCls} max-w-56`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>Tüm kampanyalar</SelectItem>
              {names.campaigns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="submit">Filtrele</Button>
        {filtered && (
          <Button variant="ghost" asChild>
            <Link href={href({ q: null, urun: null, sorumlu: null, form: null, kampanya: null, lead: null })}>Temizle</Link>
          </Button>
        )}
      </form>

      {view === "tablo" ? <LeadTable rows={rows} team={team} selected={sp.lead} /> : <Kanban rows={rows} team={team} />}

      {detail && <LeadDrawer key={detail.request.id} detail={detail} team={team} closeHref={href({ lead: null })} />}
    </>
  );
}

const toggleOn = "px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

function Stat({ label, value, hint, warn }: { label: string; value: number | string; hint?: string; warn?: boolean }) {
  return (
    <Card size="sm" className="gap-0.5 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums text-navy">{value}</dd>
      {hint && <dd className={warn ? "text-xs font-semibold text-brand" : "text-xs text-muted-foreground"}>{hint}</dd>}
    </Card>
  );
}
