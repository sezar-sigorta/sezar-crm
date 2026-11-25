"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { addReminder, assignRequest, logActivity, moveStage, setCallStatus, setContactTags, setReminderDone, setRequestProduct, updateQuote } from "@/app/(app)/actions";
import type { Contact, Request } from "@/db/schema";
import { PIPELINE_OPTIONS, PRODUCTS, STAGES, callStatus, formLabel, pipelineValue, productLabel, sourceLabel } from "@/lib/constants";
import { fmtDate, fmtDateTime, toLocalInput } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
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

  // Close with Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && document.getElementById("lead-drawer-close")?.click();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sourceRows: [string, string | undefined][] = [
    ["Kanal", r.source === "meta" ? `Meta reklamı${d.platform ? ` · ${d.platform}` : ""}` : sourceLabel(r.source)],
    ["Kampanya", d.campaign],
    ["Reklam seti", d.adset],
    ["Reklam", d.ad],
    ["Form", formLabel(d.form) ?? undefined],
    ["Sayfa", d.page],
  ];

  return (
    <aside aria-label={`${c.fullName} lead detayı`} className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
      {/* 1. Başlık */}
      <header className="border-b border-line px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-navy" title={c.fullName}>
            {c.fullName}
          </h2>
          <Link id="lead-drawer-close" href={closeHref} scroll={false} className="-mr-1 grid size-8 place-items-center rounded-md text-navy hover:bg-cream" aria-label="Paneli kapat">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
        <nav className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#1d5fb8]">
          <a href="#kaynak" className="hover:underline">
            {r.source === "meta" ? "Reklamı gör" : "Kaynağı gör"}
          </a>
          <span className="text-line" aria-hidden="true">|</span>
          <a href="#form" className="hover:underline">
            Form yanıtlarını gör
          </a>
          <span className="text-line" aria-hidden="true">|</span>
          <Link href={`/kisiler/${c.id}`} className="hover:underline">
            Profili aç
          </Link>
        </nav>
      </header>

      <div className="flex-1 divide-y divide-line overflow-y-auto">
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
              <span className="text-ink-2">E-posta yok</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <Icon d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" />
            <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" className="text-[#1f9d55] hover:underline">
              WhatsApp&apos;tan yaz
            </a>
          </div>
          <Link href={`/kisiler/${c.id}`} className="mt-3 inline-block text-sm text-[#1d5fb8] hover:underline">
            İletişim bilgilerini düzenle
          </Link>
        </Section>

        {/* 3. Etiketler */}
        <Section>
          <p className="mb-2 text-xs text-ink-2">Etiketler potansiyel müşterilerinizi tanımlamanıza ve organize etmenize yardımcı olur.</p>
          <h3 className="mb-1.5 text-sm font-semibold">Bir etiket ekle</h3>
          <Tags key={c.id} contactId={c.id} initial={c.tags ?? []} suggestions={allTags} />
        </Section>

        {/* 4. Bilgi yönetimi */}
        <Section title="Potansiyel müşteri bilgileri yönetimi">
          <p className="-mt-1 mb-3 text-xs text-ink-2">
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
          <p className="-mt-1 mb-2 text-xs text-ink-2">Notlar, potansiyel müşterilerinizle ilgili önemli bilgileri hatırlamanıza yardımcı olur.</p>
          <Notes key={r.id} contactId={c.id} product={r.product} />
          {notes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-cream-l px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-2">
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
              <dt className="text-ink-2">Ad soyad</dt>
              <dd className="font-semibold">{c.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Telefon</dt>
              <dd className="font-semibold tabular-nums">{formatPhone(c.phone)}</dd>
            </div>
            <div>
              <dt className="text-ink-2">E-posta</dt>
              <dd className="font-semibold break-all">{c.email ?? "—"}</dd>
            </div>
            {answers.map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-semibold break-words">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="text-ink-2">KVKK onayı</dt>
              <dd className="font-semibold">{c.kvkkConsent ? `Var · ${fmtDate(c.kvkkConsentAt)}` : "Yok"}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Ticari ileti izni</dt>
              <dd className="font-semibold">{c.marketingConsent ? `Var · ${fmtDate(c.marketingConsentAt)}` : "Yok"}</dd>
            </div>
          </dl>
        </Section>

        {/* 9. Diğer talepler */}
        <Section title="Bu kişinin diğer talepleri">
          {others.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={leadHref(o.id)} scroll={false} className="flex items-center gap-2 px-3 py-2 hover:bg-cream-l">
                    <span className="min-w-0 flex-1 truncate font-medium">{productLabel(o.product)}</span>
                    <SourceChip code={o.source} />
                    <StageChip code={o.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Başka talep yok.</p>
          )}
        </Section>
      </div>
    </aside>
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
      <dt className="text-ink-2">{k}</dt>
      <dd className={`break-words ${v ? "" : "text-ink-2"}`}>{v || "—"}</dd>
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
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
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
          className="input pl-9"
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
            <li key={t} className="chip border-navy-l bg-[#eef1f8] text-navy">
              {t}
              <button type="button" onClick={() => save(tags.filter((x) => x !== t))} aria-label={`${t} etiketini kaldır`} className="-mr-0.5 cursor-pointer text-navy-m hover:text-navy">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
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
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          Atanan kişi
          <select defaultValue={r.assignedTo ?? ""} disabled={pending} onChange={(e) => start(() => assignRequest(r.id, e.target.value))} className="input mt-1">
            <option value="">Atanmamış</option>
            {team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Aşama
          <select value={stage} disabled={pending} onChange={(e) => changeStage(e.target.value)} className={`input mt-1 ${tone ?? ""}`}>
            {PIPELINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Ürün
          <select
            defaultValue={r.product}
            disabled={pending}
            onChange={(e) => start(() => setRequestProduct(r.id, e.target.value))}
            className={`input mt-1 ${r.product === "genel" ? "border-brand/50 text-brand" : ""}`}
          >
            {PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code === "genel" ? "Ürün seçin…" : p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Teklif tutarı (₺)
          <input
            defaultValue={r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : ""}
            inputMode="decimal"
            placeholder="—"
            onBlur={(e) => {
              const before = r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : "";
              if (e.target.value !== before) start(() => updateQuote(r.id, e.target.value));
            }}
            className="input mt-1"
          />
        </label>
      </div>
      {r.stage === "lost" && r.lostReason && <p className="mt-2 text-sm text-ink-2">Kayıp nedeni: {r.lostReason}</p>}
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
              <li key={a.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${due ? "border-brand/40 bg-orange-50" : "border-line"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.title}</span>
                  <span className={`text-xs ${due ? "font-semibold text-brand" : "text-ink-2"}`}>
                    {a.kind === "renewal" ? "Yenileme · " : ""}
                    {fmtDateTime(a.dueAt)}
                  </span>
                </span>
                <button type="button" onClick={() => start(() => setReminderDone(a.id, true))} className="btn-ghost px-2 py-1 text-xs">
                  Tamamlandı
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <fieldset className="space-y-2 text-sm">
        <legend className="sr-only">Hatırlatma</legend>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="radio" name={`plan-${requestId}`} checked={!plan} onChange={() => setPlan(false)} className="size-4 accent-navy" />
          Hatırlatma yok
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="radio" name={`plan-${requestId}`} checked={plan} onChange={() => setPlan(true)} className="size-4 accent-navy" />
          Bir hatırlatma planla
        </label>
      </fieldset>
      {plan && (
        <form {...formProps} className="mt-3 space-y-2 rounded-lg bg-cream-l p-3">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="requestId" value={requestId} />
          <label className="label">
            Ne zaman?
            <input type="datetime-local" name="at" required defaultValue={toLocalInput(tomorrow)} className="input mt-1" />
          </label>
          <label className="label">
            Ne yapılacak?
            <input name="title" required maxLength={300} defaultValue={`${productLabel(product)} için tekrar ara`} className="input mt-1" />
          </label>
          {state && "error" in state && <p className="text-sm text-brand">{state.error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary py-1.5" disabled={pending}>
              Kaydet
            </button>
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
        <textarea
          name="body"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="Bir not yaz…"
          aria-label="Not"
          className="input resize-y pr-16"
        />
        <span className="pointer-events-none absolute top-2 right-3 text-xs text-ink-2 tabular-nums">
          {text.length}/{NOTE_MAX}
        </span>
      </div>
      {state && "error" in state && <p className="mt-1 text-sm text-brand">{state.error}</p>}
      <div className="mt-2 flex justify-end">
        <button className="btn-primary py-1.5" disabled={pending || !text.trim()}>
          Kaydet
        </button>
      </div>
    </form>
  );
}
