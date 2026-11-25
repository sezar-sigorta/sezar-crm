import Link from "next/link";
import { notFound } from "next/navigation";
import { AiAnalysis } from "@/components/ai-analysis";
import { AlarmsPanel } from "@/components/alarms-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { aiEnabled } from "@/lib/ai";
import { KindChip, LifecycleChip, ProductChip, SourceChip, StageChip } from "@/components/chips";
import { ContactEditForm } from "@/components/contact-edit-form";
import { ContactQuickActions, type WaTarget } from "@/components/contact-quick-actions";
import { ConvertButton } from "@/components/convert-button";
import { CrossSell } from "@/components/cross-sell";
import { PoliciesPanel } from "@/components/policies-panel";
import { RequestCard } from "@/components/request-card";
import { RevertButton } from "@/components/revert-button";
import { Timeline } from "@/components/timeline";
import { OPEN_STAGES, productLabel, sourceLabel } from "@/lib/constants";
import { durationSince, fmtDate, fmtDateTime, fmtYmd } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { contactDetail } from "@/lib/queries";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function Kisi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await contactDetail(id);
  if (!d) notFound();
  return d.contact.lifecycle === "customer" ? <CustomerProfile d={d} /> : <LeadProfile d={d} />;
}

type Detail = NonNullable<Awaited<ReturnType<typeof contactDetail>>>;

/* ---------------------------------------------------------------- shared bits */

const requestLabel = (r: { product: string }) => `${productLabel(r.product)} talebi`;
const policyLabel = (p: { product: string }) => `${productLabel(p.product)} poliçesi`;

function labelsOf(d: Detail) {
  return Object.fromEntries([...d.requests.map((r) => [r.id, requestLabel(r)]), ...d.policies.map((p) => [p.id, policyLabel(p)])]);
}

function Breadcrumb({ customer, name }: { customer: boolean; name: string }) {
  return (
    <nav aria-label="Konum" className="mb-3 text-sm text-muted-foreground">
      <ol className="flex min-w-0 items-center gap-1">
        <li>
          <Link href={customer ? "/musteriler" : "/leadler"} className="hover:text-foreground">
            {customer ? "Müşteriler" : "Leadler"}
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="truncate text-foreground">
          {name}
        </li>
      </ol>
    </nav>
  );
}

function ContactLine({ c }: { c: Detail["contact"] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {c.kind === "kurumsal" && (
        <span className="text-navy">
          Yetkili: <b className="font-medium">{c.contactPerson ?? "—"}</b>
          {c.contactTitle && <span className="text-muted-foreground"> ({c.contactTitle})</span>}
        </span>
      )}
      <a href={`tel:+90${c.phone}`} className="font-medium text-navy tabular-nums hover:underline">
        {formatPhone(c.phone)}
      </a>
      {c.email ? (
        <a href={`mailto:${c.email}`} className="break-all text-navy hover:underline">
          {c.email}
        </a>
      ) : (
        <span className="text-muted-foreground">E-posta yok</span>
      )}
      {c.city && <span className="text-muted-foreground">{c.city}</span>}
    </div>
  );
}

function Consents({ c }: { c: Detail["contact"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">
          <h2>İzinler (KVKK)</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Aydınlatma / iletişim onayı</dt>
            <dd className={c.kvkkConsent ? "text-right text-emerald-700" : "text-right text-brand"}>
              {c.kvkkConsent ? `Var · ${fmtDateTime(c.kvkkConsentAt)}` : "Yok"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Ticari ileti (kampanya) izni</dt>
            <dd className={c.marketingConsent ? "text-right text-emerald-700" : "text-right text-muted-foreground"}>
              {c.marketingConsent ? `Var · ${fmtDateTime(c.marketingConsentAt)}` : "Yok"}
            </dd>
          </div>
        </dl>
        {!c.marketingConsent && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Ticari ileti izni olmadan bu kişiye kampanya mesajı gönderilmemeli. Yalnızca talebi ve poliçeleriyle ilgili iletişim kurulabilir.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileCard({ c }: { c: Detail["contact"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">
          <h2>Profil bilgileri</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ContactEditForm c={c} />
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------- lead */

function LeadProfile({ d }: { d: Detail }) {
  const { contact: c, requests, activities, team, reminders } = d;
  const open = requests.filter((r) => OPEN_STAGES.includes(r.stage as never));
  const channels = [...new Map(requests.map((r) => [`${r.source}|${r.sourceDetail?.campaign ?? ""}`, r])).values()];

  return (
    <>
      <Breadcrumb customer={false} name={c.fullName} />
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold break-words">{c.fullName}</h1>
                <LifecycleChip value="lead" />
                <KindChip kind={c.kind} />
              </div>
              <ContactLine c={c} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ContactQuickActions
                contactId={c.id}
                phone={c.phone}
                email={c.email}
                kind="lead"
                targets={open.map((r) => ({ key: r.id, label: productLabel(r.product), requestId: r.id }))}
              />
              <ConvertButton contactId={c.id} name={c.fullName} defaultProduct={open[0]?.product ?? requests[0]?.product} />
            </div>
          </div>
          <Separator className="mt-4" />
          <dl className="grid gap-4 pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Geldiği kanal</dt>
              <dd className="mt-1 space-y-1">
                {channels.length === 0 && "—"}
                {channels.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                    <SourceChip code={r.source} detail={r.sourceDetail} />
                    {r.sourceDetail?.campaign && <span className="text-xs text-muted-foreground">{r.sourceDetail.campaign}</span>}
                  </div>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Talep ettiği poliçeler</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {requests.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1">
                    <ProductChip code={r.product} />
                    <StageChip code={r.stage} status={r.callStatus} />
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">İlk kayıt</dt>
              <dd className="mt-1">
                {fmtDate(c.createdAt)}
                {c.preferredCallTime && <div className="text-xs text-muted-foreground">Arama tercihi: {c.preferredCallTime}</div>}
              </dd>
            </div>
          </dl>
          <CompanyInfo c={c} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-3 font-display text-base font-semibold">Talepler ({requests.length})</h2>
            <div className="space-y-3">
              {requests.map((r) => (
                <RequestCard key={r.id} r={r} team={team} />
              ))}
            </div>
          </section>
          <Timeline
            contactId={c.id}
            activities={activities}
            ownProducts={[...new Set(requests.map((r) => r.product).filter((p) => p !== "genel"))]}
            labels={labelsOf(d)}
          />
          <DocumentsPanel contactId={c.id} contactName={c.fullName} documents={d.documents} policies={d.policies} aiEnabled={aiEnabled()} />
        </div>
        <aside className="space-y-6">
          <Ai d={d} />
          <AlarmsPanel
            contactId={c.id}
            reminders={reminders}
            links={open.map((r) => ({ value: r.id, label: `${productLabel(r.product)} talebi`, field: "requestId" as const }))}
          />
          <ProfileCard c={c} />
          <Consents c={c} />
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- customer */

function CustomerProfile({ d }: { d: Detail }) {
  const { contact: c, requests, activities, team, reminders, policies } = d;
  const active = policies.filter((p) => p.status === "active");
  const open = requests.filter((r) => OPEN_STAGES.includes(r.stage as never));
  const nextRenewal = active.filter((p) => p.endDate).sort((a, b) => a.endDate!.localeCompare(b.endDate!))[0];
  const targets: WaTarget[] = [
    ...active.map((p) => ({ key: p.id, label: `${productLabel(p.product)}${p.endDate ? ` · yenileme ${fmtYmd(p.endDate)}` : ""}`, policyId: p.id })),
    ...open.map((r) => ({ key: r.id, label: `${productLabel(r.product)} (açık talep)`, requestId: r.id })),
  ];

  return (
    <>
      <Breadcrumb customer name={c.fullName} />
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold break-words">{c.fullName}</h1>
                <LifecycleChip value="customer" />
                <KindChip kind={c.kind} />
              </div>
              <ContactLine c={c} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ContactQuickActions contactId={c.id} phone={c.phone} email={c.email} kind="customer" targets={targets} />
              <RevertButton contactId={c.id} />
            </div>
          </div>
          <Separator className="mt-4" />
          <dl className="grid grid-cols-2 gap-4 pt-4 text-sm sm:grid-cols-4">
            <Stat label="Müşteri süresi" value={durationSince(c.customerSince)} hint={c.customerSince ? `Başlangıç: ${fmtDate(c.customerSince)}` : undefined} />
            <Stat label="Aktif poliçe" value={String(active.length)} hint={active.map((p) => productLabel(p.product)).join(", ") || undefined} />
            <Stat
              label="Sonraki yenileme"
              value={nextRenewal ? fmtYmd(nextRenewal.endDate) : "—"}
              hint={nextRenewal ? productLabel(nextRenewal.product) : undefined}
            />
            <Stat label="İlk geliş" value={c.firstSource ? sourceLabel(c.firstSource) : "—"} hint={fmtDate(c.createdAt)} />
          </dl>
          <CompanyInfo c={c} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <PoliciesPanel contactId={c.id} policies={policies} />
          <DocumentsPanel contactId={c.id} contactName={c.fullName} documents={d.documents} policies={policies} aiEnabled={aiEnabled()} />
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-base font-semibold">Açık talepler ({open.length})</h2>
              <div className="space-y-3">
                {open.map((r) => (
                  <RequestCard key={r.id} r={r} team={team} />
                ))}
              </div>
            </section>
          )}
          <Timeline
            contactId={c.id}
            activities={activities}
            ownProducts={[...new Set([...active.map((p) => p.product), ...open.map((r) => r.product)].filter((p) => p !== "genel"))]}
            labels={labelsOf(d)}
            title="Müşteri notları ve geçmiş"
          />
        </div>
        <aside className="space-y-6">
          <AlarmsPanel
            contactId={c.id}
            reminders={reminders}
            links={[
              ...active.map((p) => ({ value: p.id, label: `${productLabel(p.product)} poliçesi`, field: "policyId" as const })),
              ...open.map((r) => ({ value: r.id, label: `${productLabel(r.product)} talebi`, field: "requestId" as const })),
            ]}
          />
          <Ai d={d} />
          {!c.aiAnalysis && (
            <CrossSell contactId={c.id} corporate={c.kind === "kurumsal"} has={[...active.map((p) => p.product), ...open.map((r) => r.product)]} />
          )}
          <ProfileCard c={c} />
          <Consents c={c} />
        </aside>
      </div>
    </>
  );
}

function CompanyInfo({ c }: { c: Detail["contact"] }) {
  if (c.kind !== "kurumsal") return null;
  const missingTitle = !c.fullName || c.fullName === c.contactPerson;
  const rows: [string, string | null][] = [
    ["Vergi no / dairesi", [c.taxNo, c.taxOffice].filter(Boolean).join(" · ") || null],
    ["Sektör", c.sector],
    ["Çalışan sayısı", c.employeeCount],
    ["Adres", c.address],
  ];
  return (
    <div className="mt-4">
      <Separator className="mb-4" />
      {missingTitle && (
        <Alert className="mb-3 border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle />
          <AlertDescription className="text-xs text-amber-800">
            Şirket unvanı girilmemiş; şimdilik yetkilinin adı gösteriliyor. Profil bilgilerinden ekleyin.
          </AlertDescription>
        </Alert>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={v ? "mt-0.5 break-words" : "mt-0.5 text-muted-foreground"}>{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Ai({ d }: { d: Detail }) {
  return (
    <AiAnalysis
      contactId={d.contact.id}
      analysis={d.contact.aiAnalysis as never}
      analyzedAt={d.contact.aiAnalyzedAt}
      enabled={aiEnabled()}
      isCustomer={d.contact.lifecycle === "customer"}
    />
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold text-navy">{value}</dd>
      {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
