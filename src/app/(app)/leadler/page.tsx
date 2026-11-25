import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { NameCell, PageHeader, ProductChip, StageChip } from "@/components/chips";
import { ConvertButton } from "@/components/convert-button";
import { FilterSelect } from "@/components/filter-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SOURCES, STAGES, sourceLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { listLeads } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Leadler({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rows = await listLeads({ q: sp.q, source: sp.kaynak, stage: sp.asama, kind: sp.tur });
  const now = new Date();
  const filtered = !!(sp.q || sp.kaynak || sp.asama || sp.tur);

  return (
    <>
      <PageHeader title="Leadler" sub="Henüz poliçe yaptırmamış potansiyel müşteriler. Poliçe kesilince “Müşteriye dönüştür”.">
        <Button asChild>
          <Link href="/kisiler/yeni">
            <Plus data-icon="inline-start" /> Yeni lead
          </Link>
        </Button>
      </PageHeader>

      <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="pl-8" aria-label="Ara" />
        </div>
        <FilterSelect name="kaynak" label="Kanal" defaultValue={sp.kaynak} allLabel="Tüm kanallar" options={SOURCES.map((s) => ({ value: s.code, label: s.label }))} />
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
        <FilterSelect
          name="asama"
          label="Durum"
          defaultValue={sp.asama}
          allLabel="Tüm durumlar"
          options={STAGES.filter((s) => s.code !== "won").map((s) => ({ value: s.code, label: s.label }))}
        />
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
        {filtered && (
          <Button asChild variant="ghost">
            <Link href="/leadler">Temizle</Link>
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} lead</span>
      </form>

      <Card className="py-0">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-56 pl-4">Lead</TableHead>
              <TableHead>Telefon / e-posta</TableHead>
              <TableHead>Kanal</TableHead>
              <TableHead>İlgilendiği poliçeler</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Alarm</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">İşlem</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4 whitespace-normal">
                  <NameCell c={c} href={`/kisiler/${c.id}`} sub={<div className="text-xs text-muted-foreground">{ago(c.lastAt ?? c.createdAt, now)}</div>} />
                </TableCell>
                <TableCell>
                  <div className="tabular-nums">{formatPhone(c.phone)}</div>
                  {c.email && <div className="max-w-48 truncate text-xs text-muted-foreground">{c.email}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{(c.sources ?? []).map(sourceLabel).join(", ") || "—"}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {(c.products ?? []).map((p) => (
                      <ProductChip key={p} code={p} />
                    ))}
                  </div>
                </TableCell>
                <TableCell>{c.stage ? <StageChip code={c.stage} /> : "—"}</TableCell>
                <TableCell className={cn("text-xs", c.nextAlarmAt && c.nextAlarmAt < now ? "font-semibold text-brand" : "text-muted-foreground")}>
                  {c.nextAlarmAt ? `⏰ ${fmtDateTime(c.nextAlarmAt)}` : "—"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <ConvertButton contactId={c.id} name={c.fullName} defaultProduct={c.products?.[0]} size="sm" />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Lead bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
