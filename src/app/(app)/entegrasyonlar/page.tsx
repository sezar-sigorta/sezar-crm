import { headers } from "next/headers";
import { PullMetaButton } from "@/components/pull-meta-button";
import { RetryButton } from "@/components/retry-button";
import { Chip, PageHeader } from "@/components/chips";
import { EmptyText, SectionCard } from "@/components/section-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Head name={checks[0].name} ok={checks[0].ok} need={checks[0].need} />
            <CardDescription>sezarsigorta.com&apos;daki teklif ve &quot;sizi arayalım&quot; formları WordPress&apos;e kaydedilir ve aynı anda buraya gönderilir.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1">
              <Row k="Adres" v={`${base}/api/intake/website`} />
              <Row k="Başlık" v="x-sezar-secret: <WEBSITE_INTAKE_SECRET>" />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">WordPress: Ayarlar → Genel → &quot;Sezar CRM&quot; alanlarına bu adres ve anahtar girilir.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Head name={checks[1].name} ok={checks[1].ok} need={checks[1].need} />
            <CardDescription>Facebook / Instagram lead formları doldurulduğunda Meta bu adrese haber verir, CRM formu Graph API&apos;den çeker.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1">
              <Row k="Callback URL" v={`${base}/api/meta/webhook`} />
              <Row k="Verify token" v="<META_VERIFY_TOKEN>" />
              <Row k="Alan" v="Page → leadgen" />
            </dl>
            {checks[1].ok && <PullMetaButton />}
          </CardContent>
        </Card>
      </div>

      <SectionCard title="Son gelen kayıtlar">
        {rows.length === 0 ? (
          <EmptyText text="Henüz dışarıdan kayıt gelmedi." />
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Zaman</TableHead>
                <TableHead>Kanal</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="pr-5">Hata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5">{fmtDateTime(r.createdAt)}</TableCell>
                  <TableCell>{r.channel === "meta" ? "Meta" : "Web sitesi"}</TableCell>
                  <TableCell>
                    {r.status === "processed" ? (
                      <Chip tone="border-emerald-200 bg-emerald-50 text-emerald-800">İşlendi</Chip>
                    ) : r.status === "failed" ? (
                      <Chip tone="border-orange-200 bg-orange-50 text-brand">Hata</Chip>
                    ) : (
                      <Chip tone="border-line text-ink-2">Bekliyor</Chip>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-xs whitespace-normal text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="line-clamp-2 break-all">{r.error ?? ""}</span>
                      {r.status !== "processed" && <RetryButton id={r.id} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}

function Head({ name, ok, need }: { name: string; ok: boolean; need: string }) {
  return (
    <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
      {name}
      {ok ? (
        <Chip tone="border-emerald-200 bg-emerald-50 text-emerald-800">Ayarlı</Chip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Chip tone="border-orange-200 bg-orange-50 text-brand">Ayarlanmadı</Chip>
            </span>
          </TooltipTrigger>
          <TooltipContent>Eksik: {need}</TooltipContent>
        </Tooltip>
      )}
    </CardTitle>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono text-xs leading-5 break-all">{v}</dd>
    </div>
  );
}
