import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AiAnalysis } from "@/components/ai-analysis";
import { AlarmsPanel } from "@/components/alarms-panel";
import { KindChip, LifecycleChip, SourceChip } from "@/components/chips";
import { ContactQuickActions, type WaTarget } from "@/components/contact-quick-actions";
import { CrossSell } from "@/components/cross-sell";
import { DocumentsPanel } from "@/components/documents-panel";
import { EditContactSheet } from "@/components/edit-contact-sheet";
import { SetCrumbs } from "@/components/header-crumbs";
import { PoliciesPanel } from "@/components/policies-panel";
import { ProfileMenu } from "@/components/profile-menu";
import { RequestCard } from "@/components/request-card";
import { Timeline } from "@/components/timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiEnabled } from "@/lib/ai";
import { OPEN_STAGES, productLabel, sourceLabel } from "@/lib/constants";
import { durationSince, fmtDate, fmtDateTime, fmtYmd, initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { contactDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Detail = NonNullable<Awaited<ReturnType<typeof contactDetail>>>;
type Row = [label: string, value: React.ReactNode];

/**
 * Person profile (lead or customer): a one-line header, open requests as compact rows,
 * tabs for activity / policies / documents, and a read-only details column on the right.
 */
export default async function Kisi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await contactDetail(id);
  if (!d) notFound();

  const { contact: c, requests, policies, reminders, team } = d;
  const customer = c.lifecycle === "customer";
  const active = policies.filter((p) => p.status === "active");
  const open = requests.filter((r) => OPEN_STAGES.includes(r.stage as never));
  // Leads: every request (it's their whole story). Customers: only the ones still open.
  const shownRequests = customer ? open : requests;

  const targets: WaTarget[] = customer
    ? [
        ...active.map((p) => ({ key: p.id, label: `${productLabel(p.product)}${p.endDate ? ` · yenileme ${fmtYmd(p.endDate)}` : ""}`, policyId: p.id })),
        ...open.map((r) => ({ key: r.id, label: `${productLabel(r.product)} (açık talep)`, requestId: r.id })),
      ]
    : open.map((r) => ({ key: r.id, label: productLabel(r.product), requestId: r.id }));

  const ownProducts = [...new Set((customer ? [...active.map((p) => p.product), ...open.map((r) => r.product)] : requests.map((r) => r.product)).filter((p) => p !== "genel"))];
  const labels = Object.fromEntries([
    ...requests.map((r) => [r.id, `${productLabel(r.product)} talebi`]),
    ...policies.map((p) => [p.id, `${productLabel(p.product)} poliçesi`]),
  ]);
  const alarmLinks = [
    ...(customer ? active.map((p) => ({ value: p.id, label: `${productLabel(p.product)} poliçesi`, field: "policyId" as const })) : []),
    ...open.map((r) => ({ value: r.id, label: `${productLabel(r.product)} talebi`, field: "requestId" as const })),
  ];
  const firstSource = requests.at(-1) ?? requests[0];

  return (
    <>
      <SetCrumbs items={[{ label: customer ? "Müşteriler" : "Leadler", href: customer ? "/musteriler" : "/leadler" }, { label: c.fullName }]} />

      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar className="size-12">
          <AvatarFallback className="text-base font-medium">{initials(c.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight break-words">{c.fullName}</h1>
            <LifecycleChip value={c.lifecycle} />
            <KindChip kind={c.kind} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {c.kind === "kurumsal" && c.contactPerson && c.contactPerson !== c.fullName && (
              <>
                <span>
                  {c.contactPerson}
                  {c.contactTitle && ` (${c.contactTitle})`}
                </span>
                <Dot />
              </>
            )}
            <a href={`tel:+90${c.phone}`} className="tabular-nums hover:text-foreground hover:underline">
              {formatPhone(c.phone)}
            </a>
            {c.email && (
              <>
                <Dot />
                <a href={`mailto:${c.email}`} className="break-all hover:text-foreground hover:underline">
                  {c.email}
                </a>
              </>
            )}
            {c.city && (
              <>
                <Dot />
                <span>{c.city}</span>
              </>
            )}
            {firstSource && (
              <>
                <Dot />
                <SourceChip code={firstSource.source} detail={firstSource.sourceDetail} />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContactQuickActions contactId={c.id} phone={c.phone} email={c.email} kind={customer ? "customer" : "lead"} targets={targets} />
          <ProfileMenu contactId={c.id} name={c.fullName} customer={customer} defaultProduct={open[0]?.product ?? requests[0]?.product} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {shownRequests.length > 0 && (
            <section aria-labelledby="req-h" className="flex flex-col gap-2">
              <h2 id="req-h" className="text-sm font-medium">
                {customer ? "Açık talepler" : "Talepler"} <span className="text-muted-foreground tabular-nums">{shownRequests.length}</span>
              </h2>
              {shownRequests.map((r, i) => (
                <RequestCard key={r.id} r={r} team={team} defaultOpen={!customer && i === 0 && shownRequests.length === 1} />
              ))}
            </section>
          )}

          <Tabs defaultValue="aktivite" className="gap-4">
            <TabsList>
              <TabsTrigger value="aktivite">Aktivite</TabsTrigger>
              {(customer || policies.length > 0) && (
                <TabsTrigger value="policeler">
                  Poliçeler
                  <Badge variant="secondary" className="tabular-nums">
                    {active.length}
                  </Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="belgeler">
                Belgeler
                <Badge variant="secondary" className="tabular-nums">
                  {d.documents.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="aktivite">
              <Timeline contactId={c.id} activities={d.activities} ownProducts={ownProducts} labels={labels} />
            </TabsContent>
            {(customer || policies.length > 0) && (
              <TabsContent value="policeler">
                <PoliciesPanel contactId={c.id} policies={policies} />
              </TabsContent>
            )}
            <TabsContent value="belgeler">
              <DocumentsPanel contactId={c.id} contactName={c.fullName} documents={d.documents} policies={policies} aiEnabled={aiEnabled()} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Details d={d} />
          <AlarmsPanel contactId={c.id} reminders={reminders} links={alarmLinks} />
          <AiAnalysis contactId={c.id} analysis={c.aiAnalysis as never} analyzedAt={c.aiAnalyzedAt} enabled={aiEnabled()} isCustomer={customer} />
          {customer && !c.aiAnalysis && (
            <CrossSell contactId={c.id} corporate={c.kind === "kurumsal"} has={[...active.map((p) => p.product), ...open.map((r) => r.product)]} />
          )}
        </aside>
      </div>
    </>
  );
}

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/** Read-only "label: value" list; the form lives in the "Düzenle" side panel. */
function Details({ d }: { d: Detail }) {
  const { contact: c, policies, requests } = d;
  const corp = c.kind === "kurumsal";
  const active = policies.filter((p) => p.status === "active");
  const nextRenewal = active.filter((p) => p.endDate).sort((a, b) => a.endDate!.localeCompare(b.endDate!))[0];
  const channels = [...new Map(requests.map((r) => [`${r.source}|${r.sourceDetail?.campaign ?? ""}`, r])).values()];
  const missingTitle = corp && (!c.fullName || c.fullName === c.contactPerson);

  const groups: Row[][] = [
    c.lifecycle === "customer"
      ? [
          ["Müşteri süresi", c.customerSince ? `${durationSince(c.customerSince)} · ${fmtDate(c.customerSince)}` : null],
          ["Aktif poliçe", active.length ? `${active.length} · ${active.map((p) => productLabel(p.product)).join(", ")}` : "Yok"],
          ["Sonraki yenileme", nextRenewal ? `${fmtYmd(nextRenewal.endDate)} · ${productLabel(nextRenewal.product)}` : null],
          ["İlk geliş", c.firstSource ? `${sourceLabel(c.firstSource)} · ${fmtDate(c.createdAt)}` : fmtDate(c.createdAt)],
        ]
      : [
          [
            "Kaynak",
            channels.length ? (
              <span className="flex flex-col items-end gap-1">
                {channels.map((r) => (
                  <span key={r.id} className="flex flex-col items-end">
                    <SourceChip code={r.source} detail={r.sourceDetail} />
                    {r.sourceDetail?.campaign && <span className="text-xs text-muted-foreground">{r.sourceDetail.campaign}</span>}
                  </span>
                ))}
              </span>
            ) : null,
          ],
          ["İlk kayıt", fmtDate(c.createdAt)],
        ],
    [
      ["Tür", corp ? "Kurumsal" : "Bireysel"],
      ...(corp ? ([["Yetkili", c.contactPerson ? `${c.contactPerson}${c.contactTitle ? ` (${c.contactTitle})` : ""}` : null]] as Row[]) : []),
      ["Telefon", formatPhone(c.phone)],
      ["E-posta", c.email],
      ["Şehir", c.city],
      ...(corp
        ? ([
            ["Vergi no", [c.taxNo, c.taxOffice].filter(Boolean).join(" · ") || null],
            ["Sektör", c.sector],
            ["Çalışan", c.employeeCount],
            ["Adres", c.address],
          ] as Row[])
        : ([
            ["Doğum tarihi", c.birthDate ? fmtYmd(c.birthDate) : null],
            ["Meslek", c.occupation],
          ] as Row[])),
      ["Arama tercihi", c.preferredCallTime],
    ],
    [
      ["KVKK onayı", c.kvkkConsent ? <span title={fmtDateTime(c.kvkkConsentAt)}>Var</span> : <span className="text-brand">Yok</span>],
      ["Ticari ileti izni", c.marketingConsent ? <span title={fmtDateTime(c.marketingConsentAt)}>Var</span> : "Yok"],
    ],
  ];

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3!">
        <CardTitle className="text-sm">Detaylar</CardTitle>
        <CardAction>
          <EditContactSheet c={c} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-4 text-sm">
        {missingTitle && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle />
            <AlertDescription className="text-xs text-amber-800">Şirket unvanı girilmemiş; şimdilik yetkilinin adı gösteriliyor.</AlertDescription>
          </Alert>
        )}
        {groups.map((rows, i) => (
          <div key={i} className="flex flex-col gap-3">
            {i > 0 && <Separator />}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className={v ? "text-right break-words" : "text-right text-muted-foreground"}>{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {c.notes && (
          <>
            <Separator />
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{c.notes}</p>
          </>
        )}
        {!c.marketingConsent && <p className="text-xs text-muted-foreground">Ticari ileti izni yok: kampanya mesajı gönderilmemeli.</p>}
      </CardContent>
    </Card>
  );
}
