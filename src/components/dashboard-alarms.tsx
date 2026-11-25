"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setReminderDone, snoozeReminder } from "@/app/(app)/actions";
import { ago, fmtDateTime } from "@/lib/format";

type Alarm = { id: string; title: string; dueAt: Date; kind: string; contactId: string; fullName: string; lifecycle: string };

export function DashboardAlarms({ alarms }: { alarms: Alarm[] }) {
  if (alarms.length === 0) return <p className="px-5 py-8 text-center text-sm text-ink-2">Bugün için alarm yok.</p>;
  const now = new Date();
  return (
    <ul className="divide-y divide-line">
      {alarms.map((a) => (
        <Row key={a.id} a={a} overdue={a.dueAt < now} />
      ))}
    </ul>
  );
}

function Row({ a, overdue }: { a: Alarm; overdue: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className={`flex items-start gap-3 px-5 py-3 ${pending ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        onChange={() => start(() => setReminderDone(a.id, true))}
        className="mt-1 size-4 shrink-0 accent-navy"
        aria-label={`Tamamlandı: ${a.title}`}
      />
      <div className="min-w-0 flex-1">
        <Link href={`/kisiler/${a.contactId}`} className="text-sm font-medium hover:underline">
          {a.fullName}
        </Link>
        <span className={`ml-1.5 text-xs ${a.lifecycle === "customer" ? "text-emerald-700" : "text-ink-2"}`}>
          {a.lifecycle === "customer" ? "Müşteri" : "Lead"}
        </span>
        <p className="truncate text-xs text-ink-2">
          {a.kind === "renewal" && "🔁 "}
          {a.title}
        </p>
      </div>
      <span className={`w-24 shrink-0 text-right text-xs ${overdue ? "font-semibold text-brand" : "text-ink-2"}`}>
        {overdue ? `gecikti · ${ago(a.dueAt)}` : fmtDateTime(a.dueAt)}
      </span>
      <button type="button" className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-2 hover:bg-cream" title="1 gün ertele" onClick={() => start(() => snoozeReminder(a.id, 24))}>
        +1g
      </button>
    </li>
  );
}
