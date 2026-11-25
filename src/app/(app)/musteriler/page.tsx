import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/chips";
import { CustomersTable } from "@/components/customers-table";
import { FilterSelect } from "@/components/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

      <CustomersTable
        rows={rows}
        now={now.getTime()}
        empty={sp.yenileme ? "Bu aralıkta yenilenecek poliçe yok." : "Henüz müşteri yok. Leadler sayfasından “Müşteriye dönüştür” ile ekleyin."}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
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
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={sp.q} placeholder="İsim, telefon, e-posta…" className="pl-8" aria-label="Ara" />
              </div>
              <Button type="submit" variant="outline">
                Ara
              </Button>
            </form>
          </div>
        }
      />
    </>
  );
}
