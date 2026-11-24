import { headers } from "next/headers";
import { PageHeader } from "@/components/chips";
import { RetryButton } from "@/components/retry-button";
import { fmtDateTime } from "@/lib/format";
import { recentInbox } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Entegrasyonlar() {
  const rows = await recentInbox();
  const h = await headers();
  const base = process.env.PUBLIC_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const checks = [
    { name: "Web sitesi formu", ok: !!process.env.WEBSITE_INTAKE_SECRET, need: "WEBSITE_INTAKE_SECRET" },
    {
      name: "Meta Lead Ads",
      ok: !!(process.env.META_APP_SECRET && process.env.META_VERIFY_TOKEN && process.env.META_PAGE_ACCESS_TOKEN),
      need: "META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN",
    },
  ];

  return (
    <>
      <PageHeader title="Entegrasyonlar" sub="Lead'lerin CRM'e nereden ve nasıl geldiği." />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="card p-5 text-sm">
          <Head name={checks[0].name} ok={checks[0].ok} need={checks[0].need} />
          <p className="mt-2 text-ink-2">sezarsigorta.com'daki teklif ve "sizi arayalım" formları WordPress'e kaydedilir ve aynı anda buraya gönderilir.</p>
          <dl className="mt-3 space-y-1">
            <Row k="Adres" v={`${base}/api/intake/website`} />
            <Row k="Başlık" v="x-sezar-secret: <WEBSITE_INTAKE_SECRET>" />
          </dl>
          <p className="mt-3 text-xs text-ink-2">WordPress: Ayarlar → Genel → "Sezar CRM" alanlarına bu adres ve anahtar girilir.</p>
        </section>
        <section className="card p-5 text-sm">
          <Head name={checks[1].name} ok={checks[1].ok} need={checks[1].need} />
          <p className="mt-2 text-ink-2">Facebook / Instagram lead formları doldurulduğunda Meta bu adrese haber verir, CRM formu Graph API'den çeker.</p>
          <dl className="mt-3 space-y-1">
            <Row k="Callback URL" v={`${base}/api/meta/webhook`} />
            <Row k="Verify token" v="<META_VERIFY_TOKEN>" />
            <Row k="Alan" v="Page → leadgen" />
          </dl>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3.5 text-base font-semibold">Son gelen kayıtlar</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="px-5 py-2 font-medium">Zaman</th>
              <th className="px-3 py-2 font-medium">Kanal</th>
              <th className="px-3 py-2 font-medium">Durum</th>
              <th className="px-5 py-2 font-medium">Hata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td className="px-3 py-2.5">{r.channel === "meta" ? "Meta" : "Web sitesi"}</td>
                <td className="px-3 py-2.5">
                  {r.status === "processed" ? (
                    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">İşlendi</span>
                  ) : r.status === "failed" ? (
                    <span className="chip border-orange-200 bg-orange-50 text-accent">Hata</span>
                  ) : (
                    <span className="chip border-line text-ink-2">Bekliyor</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-xs text-ink-2">
                  <div className="flex items-center gap-3">
                    <span className="line-clamp-2 break-all">{r.error ?? ""}</span>
                    {r.status !== "processed" && <RetryButton id={r.id} />}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-2">
                  Henüz dışarıdan kayıt gelmedi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Head({ name, ok, need }: { name: string; ok: boolean; need: string }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-base font-semibold">{name}</h2>
      {ok ? (
        <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">Ayarlı</span>
      ) : (
        <span className="chip border-orange-200 bg-orange-50 text-accent" title={`Eksik: ${need}`}>
          Ayarlanmadı
        </span>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-ink-2">{k}</dt>
      <dd className="break-all font-mono text-xs leading-5">{v}</dd>
    </div>
  );
}
