import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/chips";
import { LeadsTable } from "@/components/leads-table";
import { FilterSelect } from "@/components/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SOURCES, STAGES } from "@/lib/constants";
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
        <Button asChild>
          <Link href="/kisiler/yeni">
            <Plus data-icon="inline-start" /> Yeni lead
          </Link>
        </Button>
      </PageHeader>

      <LeadsTable
        rows={rows}
        now={now.getTime()}
        toolbar={
          <form role="search" className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="pl-8" aria-label="Ara" />
            </div>
            <FilterSelect
              name="kaynak"
              label="Kanal"
              defaultValue={sp.kaynak}
              allLabel="Tüm kanallar"
              options={SOURCES.map((s) => ({ value: s.code, label: s.label }))}
            />
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
          </form>
        }
      />
    </>
  );
}
