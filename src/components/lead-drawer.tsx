"use client";

import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addReminder, assignRequest, logActivity, moveStage, setCallStatus, setContactTags, setReminderDone, setRequestProduct, updateQuote } from "@/app/(app)/actions";
import type { Contact, Request } from "@/db/schema";
import { PIPELINE_OPTIONS, PRODUCTS, STAGES, callStatus, formLabel, pipelineValue, productLabel, sourceLabel } from "@/lib/constants";
import { fmtDate, fmtDateTime, toLocalInput } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SourceChip, StageChip } from "./chips";
import { useLeadHref } from "./lead-table";
import { LostDialog } from "./lost-dialog";
import { useFormAction } from "./use-form-action";

type Detail = {
  request: Request;
  contact: Contact;
  others: { id: string; product: string; stage: string; source: string; createdAt: Date }[];
  notes: { id: string; type: string; body: string | null; createdAt: Date; userName: string | null }[];
  alarms: { id: string; title: string; dueAt: Date; kind: string }[];
  allTags: string[];
};

const NOTE_MAX = 1000;

/**
 * Side panel of the Lead Merkezi. Same sections in the same order for every lead, whatever the
 * source (Meta, website, typed in): an empty field shows "—" instead of disappearing.
 */
export function LeadDrawer({ detail, team, closeHref }: { detail: Detail; team: { id: string; name: string }[]; closeHref: string }) {
  const { request: r, contact: c, others, notes, alarms, allTags } = detail;
  const d = r.sourceDetail ?? {};
  const answers = Object.entries(r.answers ?? {}).filter(([k]) => k !== "Form");
  const leadHref = useLeadHref();
  const router = useRouter();
  // The panel is URL-driven (?lead=…): closing it (Esc, overlay, × button) navigates to closeHref.
  // `open` flips first so the close animation plays while the navigation happens.
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    router.push(closeHref, { scroll: false });
  };

  const sourceRows: [string, string | undefined][] = [
    ["Kanal", r.source === "meta" ? `Meta reklamı${d.platform ? ` · ${d.platform}` : ""}` : sourceLabel(r.source)],
    ["Kampanya", d.campaign],
    ["Reklam seti", d.adset],
    ["Reklam", d.ad],
    ["Form", formLabel(d.form) ?? undefined],
    ["Sayfa", d.page],
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {/* 1. Başlık */}
        <SheetHeader className="px-5 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <SheetTitle className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-navy" title={c.fullName}>
              {c.fullName}
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" className="-mr-1 text-navy" aria-label="Paneli kapat">
                <XIcon />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{c.fullName} lead detayı</SheetDescription>
          <nav className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#1d5fb8]">
            <a href="#kaynak" className="hover:underline">
              {r.source === "meta" ? "Reklamı gör" : "Kaynağı gör"}
            </a>
            <Separator orientation="vertical" className="h-4" />
            <a href="#form" className="hover:underline">
              Form yanıtlarını gör
            </a>
            <Separator orientation="vertical" className="h-4" />
            <Link href={`/kisiler/${c.id}`} className="hover:underline">
              Profili aç
            </Link>
          </nav>
        </SheetHeader>
        <Separator />

        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
          {/* 2. İletişim */}
          <Section>
            <a href={`tel:+90${c.phone}`} className="flex items-center gap-3 text-sm tabular-nums hover:underline">
              <Icon d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
              {formatPhone(c.phone)}
            </a>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <Icon d="M4 4h16v16H4zM4 6l8 7 8-7" />
              {c.email ? (
                <a href={`mailto:${c.email}`} className="truncate text-[#1d5fb8] hover:underline">
                  {c.email}
                </a>
              ) : (
                <span className="text-muted-foreground">E-posta yok</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <Icon d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" />
              <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" className="text-wa hover:underline">
                WhatsApp&apos;tan yaz
              </a>
            </div>
            <Link href={`/kisiler/${c.id}`} className="mt-3 inline-block text-sm text-[#1d5fb8] hover:underline">
              İletişim bilgilerini düzenle
            </Link>
          </Section>

          {/* 3. Etiketler */}
          <Section>
            <p className="mb-2 text-xs text-muted-foreground">Etiketler potansiyel müşterilerinizi tanımlamanıza ve organize etmenize yardımcı olur.</p>
            <h3 className="mb-1.5 text-sm font-semibold">Bir etiket ekle</h3>
            <Tags key={c.id} contactId={c.id} initial={c.tags ?? []} suggestions={allTags} />
          </Section>

          {/* 4. Bilgi yönetimi */}
          <Section title="Potansiyel müşteri bilgileri yönetimi">
            <p className="-mt-1 mb-3 text-xs text-muted-foreground">
              {fmtDateTime(r.createdAt)} tarihinde geldi · {r.segment === "kurumsal" ? "Kurumsal" : "Bireysel"}
              {c.lifecycle === "customer" && " · Mevcut müşteri"}
            </p>
            <Management key={r.id} r={r} team={team} />
          </Section>

          {/* 5. Hatırlatma */}
          <Section title="Hatırlatma">
            <Reminders key={r.id} contactId={c.id} requestId={r.id} product={r.product} alarms={alarms} />
          </Section>

          {/* 6. Notlar */}
          <Section title="Notlar">
            <p className="-mt-1 mb-2 text-xs text-muted-foreground">Notlar, potansiyel müşterilerinizle ilgili önemli bilgileri hatırlamanıza yardımcı olur.</p>
            <Notes key={r.id} contactId={c.id} product={r.product} />
            {notes.length > 0 && (
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap break-words">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {n.type === "call" ? "Arama · " : ""}
                      {n.userName ?? "Sistem"} · {fmtDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 7. Kaynak */}
          <Section id="kaynak" title={r.source === "meta" ? "Reklam" : "Kaynak"}>
            <dl className="space-y-1.5 text-sm">
              {sourceRows.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </dl>
          </Section>

          {/* 8. Form cevapları */}
          <Section id="form" title="Form cevapları">
            <p className="mb-3 text-sm">
              {d.form_id && (
                <>
                  Potansiyel müşteri formu kodu
                  <br />
                  <span className="tabular-nums">{d.form_id}</span>
                  <br />
                </>
              )}
              Gönderim tarihi: {fmtDateTime(r.createdAt)}
            </p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Ad soyad</dt>
                <dd className="font-semibold">{c.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefon</dt>
                <dd className="font-semibold tabular-nums">{formatPhone(c.phone)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">E-posta</dt>
                <dd className="font-semibold break-all">{c.email ?? "—"}</dd>
              </div>
              {answers.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold break-words">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">KVKK onayı</dt>
                <dd className="font-semibold">{c.kvkkConsent ? `Var · ${fmtDate(c.kvkkConsentAt)}` : "Yok"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ticari ileti izni</dt>
                <dd className="font-semibold">{c.marketingConsent ? `Var · ${fmtDate(c.marketingConsentAt)}` : "Yok"}</dd>
              </div>
            </dl>
          </Section>

          {/* 9. Diğer talepler */}
          <Section title="Bu kişinin diğer talepleri">
            {others.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={leadHref(o.id)} scroll={false} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/60">
                      <span className="min-w-0 flex-1 truncate font-medium">{productLabel(o.product)}</span>
                      <SourceChip code={o.source} />
                      <StageChip code={o.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Başka talep yok.</p>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, id, children }: { title?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-2 px-5 py-4">
      {title && <h3 className="mb-2 text-base font-semibold text-navy">{title}</h3>}
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("break-words", !v && "text-muted-foreground")}>{v || "—"}</dd>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-navy" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Tags({ contactId, initial, suggestions }: { contactId: string; initial: string[]; suggestions: string[] }) {
  const [tags, setTags] = useState(initial);
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const save = (next: string[]) => {
    setTags(next);
    start(() => setContactTags(contactId, next));
  };
  const add = () => {
    const t = text.trim();
    if (t && !tags.includes(t)) save([...tags, t]);
    setText("");
  };
  return (
    <>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          list={`tags-${contactId}`}
          maxLength={40}
          placeholder="Bir etiket ara veya oluştur"
          aria-label="Etiket ekle"
          className="h-9 pl-8"
        />
        <datalist id={`tags-${contactId}`}>
          {suggestions
            .filter((s) => !tags.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      </div>
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li key={t}>
              <Badge variant="outline" className="h-6 gap-0.5 border-navy-l bg-[#eef1f8] pr-0.5 text-navy">
                {t}
                <button
                  type="button"
                  onClick={() => save(tags.filter((x) => x !== t))}
                  aria-label={`${t} etiketini kaldır`}
                  className="grid size-4 cursor-pointer place-items-center rounded-full text-navy-m hover:bg-navy-l/40 hover:text-navy"
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Radix Select can't hold "", so "Atanmamış" uses this value in the UI and "" towards the server. */
const NOBODY = "none";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Management({ r, team }: { r: Request; team: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [stage, setStage] = useState(pipelineValue(r.stage, r.callStatus));
  const [lost, setLost] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tone = r.stage === "followup" ? callStatus(r.callStatus)?.tone : STAGES.find((s) => s.code === r.stage)?.tone;

  function changeStage(value: string, reason?: string) {
    const [to, status] = value.split(":");
    if (to === "lost" && !reason) return setLost(true);
    setErr(null);
    setStage(value);
    start(async () => {
      if (to === "followup" && status) return void (await setCallStatus(r.id, status));
      const res = await moveStage(r.id, to, reason);
      if (res && "error" in res && res.error) setErr(res.error);
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field id={`d-assignee-${r.id}`} label="Atanan kişi">
          <Select defaultValue={r.assignedTo ?? NOBODY} disabled={pending} onValueChange={(v) => start(() => assignRequest(r.id, v === NOBODY ? "" : v))}>
            <SelectTrigger id={`d-assignee-${r.id}`} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NOBODY}>Atanmamış</SelectItem>
              {team.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`d-stage-${r.id}`} label="Aşama">
          <Select value={stage} disabled={pending} onValueChange={(v) => changeStage(v)}>
            <SelectTrigger id={`d-stage-${r.id}`} className={cn("h-9 w-full", tone)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PIPELINE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`d-product-${r.id}`} label="Ürün">
          <Select defaultValue={r.product} disabled={pending} onValueChange={(v) => start(() => setRequestProduct(r.id, v))}>
            <SelectTrigger id={`d-product-${r.id}`} className={cn("h-9 w-full", r.product === "genel" && "border-brand/50 text-brand")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PRODUCTS.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.code === "genel" ? "Ürün seçin…" : p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`d-quote-${r.id}`} label="Teklif tutarı (₺)">
          <Input
            id={`d-quote-${r.id}`}
            defaultValue={r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : ""}
            inputMode="decimal"
            placeholder="—"
            onBlur={(e) => {
              const before = r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : "";
              if (e.target.value !== before) start(() => updateQuote(r.id, e.target.value));
            }}
            className="h-9"
          />
        </Field>
      </div>
      {r.stage === "lost" && r.lostReason && <p className="mt-2 text-sm text-muted-foreground">Kayıp nedeni: {r.lostReason}</p>}
      {err && <p className="mt-2 text-sm text-brand">{err}</p>}
      {lost && (
        <LostDialog
          onCancel={() => setLost(false)}
          onConfirm={(reason) => {
            setLost(false);
            changeStage("lost", reason);
          }}
        />
      )}
    </>
  );
}

function Reminders({ contactId, requestId, product, alarms }: { contactId: string; requestId: string; product: string; alarms: Detail["alarms"] }) {
  const [plan, setPlan] = useState(false);
  const [state, formProps, pending] = useFormAction(addReminder);
  const [, start] = useTransition();
  const [tomorrow] = useState(() => {
    const t = new Date(Date.now() + 864e5);
    t.setHours(10, 0, 0, 0);
    return t;
  });

  useEffect(() => {
    if (state && "ok" in state) setPlan(false);
  }, [state]);

  return (
    <>
      {alarms.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {alarms.map((a) => {
            const due = new Date(a.dueAt) < new Date();
            return (
              <li key={a.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", due ? "border-brand/40 bg-orange-50" : "border-border")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.title}</span>
                  <span className={cn("text-xs", due ? "font-semibold text-brand" : "text-muted-foreground")}>
                    {a.kind === "renewal" ? "Yenileme · " : ""}
                    {fmtDateTime(a.dueAt)}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="xs" onClick={() => start(() => setReminderDone(a.id, true))}>
                  <CheckIcon />
                  Tamamlandı
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <RadioGroup value={plan ? "plan" : "none"} onValueChange={(v) => setPlan(v === "plan")} aria-label="Hatırlatma" className="gap-2.5">
        <Label htmlFor={`plan-none-${requestId}`} className="cursor-pointer gap-2.5 font-normal">
          <RadioGroupItem id={`plan-none-${requestId}`} value="none" />
          Hatırlatma yok
        </Label>
        <Label htmlFor={`plan-yes-${requestId}`} className="cursor-pointer gap-2.5 font-normal">
          <RadioGroupItem id={`plan-yes-${requestId}`} value="plan" />
          Bir hatırlatma planla
        </Label>
      </RadioGroup>
      {plan && (
        <form {...formProps} className="mt-3 space-y-3 rounded-lg bg-secondary/60 p-3">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="requestId" value={requestId} />
          <Field id={`r-at-${requestId}`} label="Ne zaman?">
            <Input id={`r-at-${requestId}`} type="datetime-local" name="at" required defaultValue={toLocalInput(tomorrow)} className="h-9 bg-card" />
          </Field>
          <Field id={`r-title-${requestId}`} label="Ne yapılacak?">
            <Input id={`r-title-${requestId}`} name="title" required maxLength={300} defaultValue={`${productLabel(product)} için tekrar ara`} className="h-9 bg-card" />
          </Field>
          {state && "error" in state && <p className="text-sm text-brand">{state.error}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              Kaydet
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

function Notes({ contactId, product }: { contactId: string; product: string }) {
  const [text, setText] = useState("");
  const [state, formProps, pending] = useFormAction(logActivity);
  useEffect(() => {
    if (state && "ok" in state) setText("");
  }, [state]);
  return (
    <form {...formProps}>
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="status" value="note" />
      {product !== "genel" && <input type="hidden" name="product" value={product} />}
      <div className="relative">
        <Textarea
          name="body"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="Bir not yaz…"
          aria-label="Not"
          className="min-h-20 resize-y pr-16 [field-sizing:fixed]"
        />
        <span className="pointer-events-none absolute top-2 right-3 text-xs text-muted-foreground tabular-nums">
          {text.length}/{NOTE_MAX}
        </span>
      </div>
      {state && "error" in state && <p className="mt-1 text-sm text-brand">{state.error}</p>}
      <div className="mt-2 flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}
