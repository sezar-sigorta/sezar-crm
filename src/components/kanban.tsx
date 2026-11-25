"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage, setCallStatus } from "@/app/(app)/actions";
import { CALL_STATUSES, FIRST_RESPONSE_SLA_MIN, PIPELINE_OPTIONS, STAGES, formLabel, pipelineValue, productLabel, sourceLabel } from "@/lib/constants";
import { ago, fmtDateTime, initials, minutesSince, nearAlarmLabel } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { useLeadHref } from "./lead-table";
import { LostDialog } from "./lost-dialog";

type Team = { id: string; name: string }[];

/** Short column titles and a colour dot per stage (the long labels live in STAGES for menus). */
const COLUMN: Record<string, { title: string; dot: string }> = {
  new: { title: "Yeni", dot: "bg-orange-500" },
  followup: { title: "Arandı – takipte", dot: "bg-sky-500" },
  won: { title: "Kazanıldı", dot: "bg-emerald-500" },
  lost: { title: "Kaybedildi", dot: "bg-stone-400" },
};
const SUB_DOT: Record<string, string> = { awaiting: "bg-amber-400", neutral: "bg-stone-400", soft_no: "bg-rose-400" };

export function Kanban({ rows, team }: { rows: RequestRow[]; team: Team }) {
  const [items, setOptimistic] = useOptimistic(rows, (state, m: { id: string; stage: string; callStatus?: string }) =>
    state.map((r) => (r.id === m.id ? { ...r, stage: m.stage, callStatus: m.callStatus ?? r.callStatus } : r)),
  );
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lost, setLost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(id: string, to: string, reason?: string, status?: string) {
    const r = items.find((x) => x.id === id);
    if (!r) return;
    if (to === "followup" && status) {
      if (r.stage === "followup" && r.callStatus === status) return;
      setError(null);
      start(async () => {
        setOptimistic({ id, stage: "followup", callStatus: status });
        try {
          await setCallStatus(id, status);
        } catch {
          setError("Durum değiştirilemedi, tekrar deneyin.");
        }
      });
      return;
    }
    if (r.stage === to) return;
    if (to === "lost" && !reason) {
      setLost(id);
      return;
    }
    setError(null);
    start(async () => {
      setOptimistic({ id, stage: to, callStatus: to === "followup" ? (r.callStatus ?? "neutral") : undefined });
      try {
        const res = await moveStage(id, to, reason);
        if (res && "error" in res && res.error) setError(res.error);
      } catch {
        setError("Aşama değiştirilemedi, tekrar deneyin.");
      }
    });
  }

  const dropProps = (key: string, onDrop: (id: string) => void, stop = false) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (stop) e.stopPropagation();
      setOver(key);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (stop) e.stopPropagation();
      setOver(null);
      setDragging(false);
      onDrop(e.dataTransfer.getData("text/plain"));
    },
  });

  const cardProps = { team, onMove: move, onDrag: setDragging };

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-accent/30 bg-orange-50 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="grid min-w-[980px] grid-cols-[1fr_1.2fr_1fr_1fr] gap-3">
          {STAGES.map((s) => {
            const col = items.filter((r) => r.stage === s.code);
            const meta = COLUMN[s.code];
            return (
              <section
                key={s.code}
                aria-label={s.label}
                {...dropProps(s.code, (id) => move(id, s.code))}
                onDragLeave={() => setOver((o) => (o === s.code ? null : o))}
                className={`flex min-w-0 max-h-[calc(100dvh-180px)] min-h-[60vh] flex-col rounded-xl border transition-colors ${
                  over === s.code ? "border-navy-m bg-navy-l/25" : dragging ? "border-dashed border-navy-l bg-cream/40" : "border-line bg-cream/40"
                }`}
              >
                <h2 className="flex items-center gap-2 border-b border-line/70 px-3.5 py-3 text-sm font-semibold text-navy">
                  <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                  {meta.title}
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-ink-2 ring-1 ring-line">{col.length}</span>
                </h2>
                <div className="flex-1 overflow-y-auto p-2">
                  {s.code === "followup" ? (
                    <div className="flex flex-col gap-3">
                      {[...CALL_STATUSES].reverse().map((cs) => {
                        const sub = col.filter((r) => (r.callStatus ?? "neutral") === cs.code);
                        const key = `followup:${cs.code}`;
                        return (
                          <div
                            key={cs.code}
                            aria-label={cs.label}
                            {...dropProps(key, (id) => move(id, "followup", undefined, cs.code), true)}
                            className={`rounded-lg transition-colors ${over === key ? "bg-navy-l/30 ring-2 ring-navy-m/40" : ""}`}
                          >
                            <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-[#f9f5ee] px-1.5 py-1 text-xs font-medium text-ink-2">
                              <span className={`size-1.5 rounded-full ${SUB_DOT[cs.code]}`} aria-hidden="true" />
                              {cs.label}
                              <span className="tabular-nums">· {sub.length}</span>
                            </div>
                            <ul className="flex min-h-8 flex-col gap-1.5 pt-1">
                              {sub.map((r) => (
                                <Card key={r.id} r={r} {...cardProps} />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {col.map((r) => (
                        <Card key={r.id} r={r} {...cardProps} />
                      ))}
                      {col.length === 0 && <li className="px-2 py-8 text-center text-xs text-ink-2">Buraya sürükleyin</li>}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {lost && (
        <LostDialog
          onCancel={() => setLost(null)}
          onConfirm={(reason) => {
            const id = lost;
            setLost(null);
            move(id, "lost", reason);
          }}
        />
      )}
    </>
  );
}

const SOURCE_DOT: Record<string, string> = { meta: "bg-[#7c5cc4]", website: "bg-navy" };

function Card({
  r,
  team,
  onMove,
  onDrag,
}: {
  r: RequestRow;
  team: Team;
  onMove: (id: string, to: string, reason?: string, status?: string) => void;
  onDrag: (on: boolean) => void;
}) {
  const leadHref = useLeadHref();
  const now = new Date();
  const late = r.stage === "new" && minutesSince(r.createdAt, now) > FIRST_RESPONSE_SLA_MIN;
  const alarm = r.nextAlarmAt ? new Date(r.nextAlarmAt) : null;
  const due = alarm && alarm < now;
  // Only reminders in the next 7 days (or overdue) are shown on the card.
  const alarmText = alarm ? nearAlarmLabel(alarm, now) : null;
  // Meta leads: which ad they came from (campaign › ad set › ad on hover).
  const d = r.sourceDetail ?? {};
  const ad = r.source === "meta" ? (d.ad ?? d.adset ?? d.campaign) : null;
  const adPath = [d.campaign, d.adset, d.ad].filter(Boolean).join(" › ");
  const owner = team.find((u) => u.id === r.assignedTo);
  const source = r.source === "meta" && r.sourceDetail?.platform ? r.sourceDetail.platform : sourceLabel(r.source);
  const origin = [formLabel(r.sourceDetail?.form), r.sourceDetail?.campaign].filter(Boolean).join(" · ");

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", r.id);
        e.dataTransfer.effectAllowed = "move";
        onDrag(true);
      }}
      onDragEnd={() => onDrag(false)}
      className={`group relative cursor-grab rounded-lg border bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,33,61,0.06)] transition hover:border-navy-m/40 hover:shadow-md active:cursor-grabbing ${
        late ? "border-accent/40" : "border-line"
      }`}
    >
      {late && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent" aria-hidden="true" />}

      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream text-[11px] font-semibold text-navy">{initials(r.fullName)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={leadHref(r.id)} scroll={false} className="truncate text-sm font-medium text-navy after:absolute after:inset-0 hover:underline" title={r.fullName}>
              {r.fullName}
            </Link>
            {r.lifecycle === "customer" && (
              <span className="shrink-0 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Müşteri</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2" title={origin || undefined}>
            <span className={`truncate ${r.product === "genel" ? "font-medium text-accent" : "text-navy"}`}>
              {r.product === "genel" ? "Ürün seçilmedi" : productLabel(r.product)}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`size-1.5 shrink-0 rounded-full ${SOURCE_DOT[r.source] ?? "bg-stone-400"}`} aria-hidden="true" />
            <span className="truncate">{source}</span>
          </div>
          {ad && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-[#5b3a9b]" title={`Reklam: ${adPath}`}>
              <MegaphoneIcon />
              <span className="truncate">{ad}</span>
            </div>
          )}
        </div>
        {owner ? (
          <span title={`Atanan: ${owner.name}`} className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-[9px] font-semibold text-cream">
            {initials(owner.name)}
          </span>
        ) : (
          <span title="Atanmamış" className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-navy-l text-[10px] text-navy-m">
            ?
          </span>
        )}
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-2 pl-[42px] text-[11px] whitespace-nowrap">
        <span className={late ? "font-semibold text-accent" : "text-ink-2"} title={fmtDateTime(r.createdAt)}>
          {ago(r.createdAt, now)}
        </span>
        {alarm && alarmText && (
          <span
            title={`Hatırlatma: ${fmtDateTime(alarm)}`}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px ${due ? "bg-orange-50 font-semibold text-accent ring-1 ring-accent/30" : "text-ink-2"}`}
          >
            <BellIcon />
            {alarmText}
          </span>
        )}
        {/* Quick actions: on hover (always visible on touch screens). Above the card-wide link. */}
        <span className="absolute right-2 bottom-2 z-10 flex gap-0.5 rounded-md bg-white opacity-0 shadow-sm ring-1 ring-line transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <a href={`tel:+90${r.phone}`} title={`Ara: ${formatPhone(r.phone)}`} aria-label={`${r.fullName} kişisini ara`} className="grid size-6 place-items-center rounded-md text-navy hover:bg-cream">
            <PhoneIcon />
          </a>
          <a href={whatsappLink(r.phone)} target="_blank" rel="noreferrer" title="WhatsApp" aria-label={`${r.fullName} kişisine WhatsApp`} className="grid size-6 place-items-center rounded-md text-[#1f9d55] hover:bg-emerald-50">
            <ChatIcon />
          </a>
        </span>
      </div>

      {/* Keyboard / touch alternative to drag-and-drop */}
      <label className="sr-only" htmlFor={`st-${r.id}`}>
        Aşama
      </label>
      <select
        id={`st-${r.id}`}
        value={pipelineValue(r.stage, r.callStatus)}
        onChange={(e) => {
          const [stage, status] = e.target.value.split(":");
          onMove(r.id, stage, undefined, status);
        }}
        className="relative z-10 mt-2 w-full rounded-md border border-line bg-cream-l px-2 py-1 text-xs text-navy md:sr-only md:focus:not-sr-only"
      >
        {PIPELINE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </li>
  );
}

const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const BellIcon = () => (
  <svg {...icon} className="size-3">
    <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />
  </svg>
);
const MegaphoneIcon = () => (
  <svg {...icon} className="size-3 shrink-0">
    <path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
  </svg>
);
const PhoneIcon = () => (
  <svg {...icon} className="size-3.5">
    <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
  </svg>
);
const ChatIcon = () => (
  <svg {...icon} className="size-3.5">
    <path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" />
  </svg>
);
