"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addReminder, deleteReminder, setReminderDone, snoozeReminder } from "@/app/(app)/actions";
import type { Reminder } from "@/db/schema";
import { ago, fmtDateTime, toLocalInput, todayYmd } from "@/lib/format";
import { useFormAction } from "./use-form-action";

type Link = { value: string; label: string; field: "requestId" | "policyId" };

const QUICK_TITLES = ["Geri ara", "Teklif için dönüş al", "Belge / bilgi iste", "Yenileme teklifi hazırla", "Doğum günü tebriği"];

export function AlarmsPanel({ contactId, reminders, links }: { contactId: string; reminders: Reminder[]; links: Link[] }) {
  const open = reminders.filter((r) => !r.doneAt);
  const done = reminders.filter((r) => r.doneAt);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(open.length === 0);
  const now = new Date();

  return (
    <section className="card p-5" aria-labelledby="alarms-h">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="alarms-h" className="text-base font-semibold">
          Alarmlar
        </h2>
        {open.length > 0 && <span className="text-xs text-ink-2">{open.length} açık</span>}
        {!adding && (
          <button type="button" className="btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={() => setAdding(true)}>
            + Alarm kur
          </button>
        )}
      </div>

      {adding && <AddAlarm contactId={contactId} links={links} onDone={() => setAdding(false)} canCancel={open.length > 0} />}

      <ul className="space-y-2">
        {open.map((r) => (
          <AlarmRow key={r.id} r={r} overdue={r.dueAt < now} />
        ))}
        {open.length === 0 && !adding && <li className="text-sm text-ink-2">Açık alarm yok.</li>}
      </ul>

      {done.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button type="button" className="text-xs text-ink-2 hover:text-navy" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
            {showDone ? "▾" : "▸"} Tamamlananlar ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((r) => (
                <AlarmRow key={r.id} r={r} overdue={false} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AlarmRow({ r, overdue }: { r: Reminder; overdue: boolean }) {
  const [pending, start] = useTransition();
  const isDone = !!r.doneAt;
  return (
    <li className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${overdue ? "border-brand/40 bg-orange-50/60" : "border-line"} ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={isDone}
        onChange={(e) => start(() => setReminderDone(r.id, e.target.checked))}
        className="mt-1 size-4 shrink-0 accent-navy"
        aria-label={isDone ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug break-words ${isDone ? "text-ink-2 line-through" : ""}`}>{r.title}</p>
        <p className={`mt-0.5 text-xs ${overdue ? "font-semibold text-brand" : "text-ink-2"}`}>
          {r.kind === "renewal" && "🔁 "}
          {fmtDateTime(r.dueAt)} · {isDone ? `tamamlandı ${ago(r.doneAt)}` : overdue ? `gecikti, ${ago(r.dueAt)}` : ago(r.dueAt)}
        </p>
      </div>
      {!isDone && (
        <div className="flex shrink-0 gap-1">
          <button type="button" title="1 gün ertele" className="rounded px-1.5 py-0.5 text-xs text-ink-2 hover:bg-cream" onClick={() => start(() => snoozeReminder(r.id, 24))}>
            +1g
          </button>
          <button type="button" title="Sil" aria-label="Alarmı sil" className="rounded px-1.5 py-0.5 text-xs text-ink-2 hover:bg-cream" onClick={() => start(() => deleteReminder(r.id))}>
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

function AddAlarm({ contactId, links, onDone, canCancel }: { contactId: string; links: Link[]; onDone: () => void; canCancel: boolean }) {
  const [state, formProps, pending] = useFormAction(addReminder);
  const formRef = useRef<HTMLFormElement>(null);
  const [at, setAt] = useState("");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setAt("");
      setTitle("");
      if (canCancel) onDone();
    }
  }, [state, onDone, canCancel]);

  const tomorrowAt = (days: number, h = 10) => {
    const ymd = todayYmd(new Date(Date.now() + days * 864e5));
    return toLocalInput(new Date(`${ymd}T${String(h).padStart(2, "0")}:00:00+03:00`));
  };
  const sel = links.find((l) => l.value === link);

  return (
    <form ref={formRef} {...formProps} className="mb-3 space-y-2 rounded-lg bg-cream-l p-3">
      <input type="hidden" name="contactId" value={contactId} />
      {sel && <input type="hidden" name={sel.field} value={sel.value} />}
      <input type="datetime-local" name="at" required value={at} onChange={(e) => setAt(e.target.value)} className="input" aria-label="Alarm zamanı" />
      <div className="flex flex-wrap gap-1">
        {[
          ["+1 saat", toLocalInput(new Date(Date.now() + 3600e3))],
          ["Yarın 10:00", tomorrowAt(1)],
          ["3 gün", tomorrowAt(3)],
          ["1 hafta", tomorrowAt(7)],
          ["1 ay", tomorrowAt(30)],
        ].map(([label, v]) => (
          <button key={label} type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setAt(v)}>
            {label}
          </button>
        ))}
      </div>
      <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ne yapılacak?" maxLength={300} className="input" list="sz-alarm-titles" />
      <datalist id="sz-alarm-titles">
        {QUICK_TITLES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {links.length > 0 && (
        <select value={link} onChange={(e) => setLink(e.target.value)} className="input" aria-label="İlgili talep / poliçe">
          <option value="">Genel (kişiye bağlı)</option>
          {links.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-end gap-2">
        {state?.error && <span className="mr-auto text-xs text-brand">{state.error}</span>}
        {canCancel && (
          <button type="button" className="btn-ghost py-1.5" onClick={onDone}>
            Vazgeç
          </button>
        )}
        <button className="btn-primary py-1.5" disabled={pending}>
          Alarm kur
        </button>
      </div>
    </form>
  );
}
