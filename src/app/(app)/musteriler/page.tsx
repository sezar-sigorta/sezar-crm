import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { NameCell, PageHeader, ProductChip } from "@/components/chips";
import { FilterSelect } from "@/components/filter-select";
import { RenewalBadge } from "@/components/renewal-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { durationSince, fmtDateTime, fmtYmd } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { listCustomers } from "@/lib/queries";
import { cn } from "@/lib/utils";

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
  const current = sp.yenileme ?? "";
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
        <Button asChild>
          <Link href="/kisiler/yeni?tur=musteri">
            <Plus data-icon="inline-start" /> Yeni müşteri
          </Link>
        </Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={current || "all"} className="max-w-full overflow-x-auto">
          <TabsList aria-label="Yenileme filtresi">
            {TABS.map((t) => (
              <TabsTrigger key={t.v} value={t.v || "all"} asChild>
                <Link href={`/musteriler${qs(t.v)}`} aria-current={current === t.v ? "page" : undefined}>
                  {t.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form role="search" className="flex flex-wrap gap-2">
          {sp.yenileme && <input type="hidden" name="yenileme" value={sp.yenileme} />}
          <FilterSelect
            name="tur"
            label="Tür"
            defaultValue={sp.tur}
            allLabel="Bireysel + kurumsal"
            options={[
              { value: "bireysel", label: "Bireysel" },
              { value: "kurumsal", label: "Kurumsal" },
            ]}
          />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="pl-8" aria-label="Ara" />
          </div>
          <Button type="submit" variant="outline">
            Ara
          </Button>
        </form>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} müşteri</span>
      </div>

      <Card className="py-0">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-60 pl-4">Müşteri</TableHead>
              <TableHead>Telefon / e-posta</TableHead>
              <TableHead>Müşteri süresi</TableHead>
              <TableHead>Poliçeler</TableHead>
              <TableHead>Sonraki yenileme</TableHead>
              <TableHead className="pr-4">Alarm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4 whitespace-normal">
                  <NameCell c={c} href={`/kisiler/${c.id}`} sub={c.city && c.kind !== "kurumsal" ? <div className="text-xs text-muted-foreground">{c.city}</div> : null} />
                </TableCell>
                <TableCell>
                  <div className="tabular-nums">{formatPhone(c.phone)}</div>
                  {c.email && <div className="max-w-48 truncate text-xs text-muted-foreground">{c.email}</div>}
                </TableCell>
                <TableCell>{durationSince(c.customerSince, now)}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {(c.products ?? []).map((p) => (
                      <ProductChip key={p} code={p} />
                    ))}
                    {!c.activeCount && <span className="text-xs text-brand">Poliçe girilmemiş</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {c.nextRenewal ? (
                    <div className="flex items-center gap-2">
                      {fmtYmd(c.nextRenewal)} <RenewalBadge ymd={c.nextRenewal} />
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={cn("pr-4 text-xs", c.nextAlarmAt && c.nextAlarmAt < now ? "font-semibold text-brand" : "text-muted-foreground")}>
                  {c.nextAlarmAt ? `⏰ ${fmtDateTime(c.nextAlarmAt)}` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-10 text-center whitespace-normal text-muted-foreground">
                  {sp.yenileme ? "Bu aralıkta yenilenecek poliçe yok." : "Henüz müşteri yok. Leadler sayfasından “Müşteriye dönüştür” ile ekleyin."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
