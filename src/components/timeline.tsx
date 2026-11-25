"use client";

import { useEffect, useState } from "react";
import { logActivity } from "@/app/(app)/actions";
import { NOTE_STATUSES, NOTE_TOPICS, PRODUCTS, productLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { useFormAction } from "./use-form-action";

type Act = {
  id: string;
  type: string;
  body: string | null;
  meta: Record<string, unknown>;
  requestId: string | null;
  createdAt: Date;
  userName: string | null;
};

const ICON: Record<string, { label: string; tone: string }> = {
  form: { label: "Form", tone: "bg-cream text-navy" },
  note: { label: "Not", tone: "bg-amber-100 text-amber-800" },
  call: { label: "Görüşme", tone: "bg-sky-100 text-sky-800" },
  whatsapp: { label: "WhatsApp", tone: "bg-emerald-100 text-emerald-800" },
  stage: { label: "Aşama", tone: "bg-violet-100 text-violet-800" },
  assign: { label: "Atama", tone: "bg-stone-100 text-stone-700" },
  followup: { label: "Alarm", tone: "bg-orange-100 text-orange-800" },
  system: { label: "Sistem", tone: "bg-stone-100 text-stone-700" },
};

export function Timeline({
  contactId,
  activities,
  ownProducts,
  labels,
  title = "Notlar ve geçmiş",
}: {
  contactId: string;
  activities: Act[];
  /** Products this person has a policy or request for (listed first in "İlgili poliçe"). */
  ownProducts: string[];
  /** id → label for every policy and request of the person (to label older entries). */
  labels: Record<string, string>;
  title?: string;
}) {
  const [filter, setFilter] = useState<"all" | "note" | "call">("all");
  const isNote = (a: Act) => a.type === "note" || (a.type === "call" && !!a.meta?.text);
  const shown = activities.filter((a) => filter === "all" || (filter === "note" ? isNote(a) : a.type === "call" || a.type === "whatsapp"));
  const noteCount = activities.filter(isNote).length;

  return (
    <section className="card">
      <NoteForm contactId={contactId} ownProducts={ownProducts} />

      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h2 className="mr-auto text-base font-semibold">{title}</h2>
        {(
          [
            ["all", "Tümü"],
            ["note", `Notlar (${noteCount})`],
            ["call", "Görüşmeler"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${filter === v ? "border-navy bg-navy text-cream" : "border-line text-ink-2 hover:text-navy"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ol className="p-4">
        {shown.length === 0 && <li className="text-sm text-ink-2">Kayıt yok.</li>}
        {shown.map((a) => {
          const ic = ICON[a.type] ?? ICON.system;
          const tags = tagsOf(a, labels);
          return (
            <li key={a.id} className="flex gap-3 pb-4 pl-1 last:pb-0">
              <span className={`mt-0.5 h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${ic.tone}`}>{ic.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words whitespace-pre-wrap">{a.body}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                  {tags.map((t) => (
                    <span key={t} className="rounded border border-line bg-cream-l px-1.5 py-px text-[11px] text-navy">
                      {t}
                    </span>
                  ))}
                  <span title={fmtDateTime(a.createdAt)}>
                    {ago(a.createdAt)}
                    {a.userName && ` · ${a.userName}`}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function tagsOf(a: Act, labels: Record<string, string>) {
  const topics = (a.meta?.topics as string[] | undefined) ?? [];
  const product = a.meta?.product as string | undefined;
  if (product) return [productLabel(product), ...topics];
  // Older entries: linked policies / requests.
  const links = (a.meta?.links as { id: string }[] | undefined) ?? [];
  const fromLinks = links.map((l) => labels[l.id]).filter(Boolean);
  if (fromLinks.length || topics.length) return [...new Set([...fromLinks, ...topics])];
  return a.requestId && labels[a.requestId] ? [labels[a.requestId]] : [];
}

function NoteForm({ contactId, ownProducts }: { contactId: string; ownProducts: string[] }) {
  const [state, formProps, pending] = useFormAction(logActivity);
  const [product, setProduct] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("note");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setProduct("");
      setTopic("");
      setStatus("note");
      setBody("");
    }
  }, [state]);
  const others = PRODUCTS.filter((p) => p.code !== "genel" && !ownProducts.includes(p.code));

  return (
    <form {...formProps} className="@container space-y-3 border-b border-line p-4">
      <input type="hidden" name="contactId" value={contactId} />
      <div className="grid gap-2 @lg:grid-cols-3">
        <label className="text-xs text-ink-2">
          İlgili poliçe
          <select name="product" value={product} onChange={(e) => setProduct(e.target.value)} className="input mt-1">
            <option value="">Genel</option>
            {ownProducts.length > 0 && (
              <optgroup label="Bu kişide olanlar">
                {ownProducts.map((p) => (
                  <option key={p} value={p}>
                    {productLabel(p)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={ownProducts.length ? "Diğer poliçeler" : "Poliçeler"}>
              {others.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Sebep
          <select name="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="input mt-1">
            <option value="">Seçiniz</option>
            {NOTE_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Durum
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input mt-1">
            {NOTE_STATUSES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        name="body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={status === "note" ? "Not…" : "Görüşme notu (isteğe bağlı)"}
        className="input resize-y"
        aria-label="Not"
      />

      <div className="flex items-center justify-end gap-3">
        {state?.error && (
          <span role="alert" className="mr-auto text-sm text-brand">
            {state.error}
          </span>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
