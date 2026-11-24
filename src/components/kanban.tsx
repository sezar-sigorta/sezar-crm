"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage, setCallStatus } from "@/app/(app)/actions";
import { CALL_STATUSES, FIRST_RESPONSE_SLA_MIN, PIPELINE_OPTIONS, STAGES, formLabel, pipelineValue, productLabel, sourceLabel } from "@/lib/constants";
import { ago, initials, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { LostDialog } from "./lost-dialog";

type Team = { id: string; name: string }[];

export function Kanban({ rows, team }: { rows: RequestRow[]; team: Team }) {
  const [items, setOptimistic] = useOptimistic(rows, (state, m: { id: string; stage: string; callStatus?: string }) =>
    state.map((r) => (r.id === m.id ? { ...r, stage: m.stage, callStatus: m.callStatus ?? r.callStatus } : r)),
  );
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
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

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-accent/30 bg-orange-50 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="grid min-w-[980px] grid-cols-[1fr_1.5fr_1fr_1fr] gap-3">
          {STAGES.map((s) => {
            const col = items.filter((r) => r.stage === s.code);
            return (
              <section
                key={s.code}
                aria-label={s.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(s.code);
                }}
                onDragLeave={() => setOver((o) => (o === s.code ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  move(e.dataTransfer.getData("text/plain"), s.code);
                }}
                className={`flex min-h-[60vh] flex-col rounded-xl border bg-cream/50 transition-colors ${
                  over === s.code ? "border-navy-m bg-navy-l/30" : "border-line"
                }`}
              >
                <h2 className="flex items-start gap-2 px-3 py-2.5 text-sm font-semibold">
                  <span className={`chip ${s.tone} whitespace-normal`}>{s.column}</span>
                  <span className="pt-0.5 text-xs font-normal text-ink-2 tabular-nums">{col.length}</span>
                </h2>
                {s.code === "followup" ? (
                  <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                    {[...CALL_STATUSES].reverse().map((cs) => {
                      const sub = col.filter((r) => (r.callStatus ?? "neutral") === cs.code);
                      const key = `followup:${cs.code}`;
                      return (
                        <div
                          key={cs.code}
                          aria-label={cs.label}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOver(key);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOver(null);
                            move(e.dataTransfer.getData("text/plain"), "followup", undefined, cs.code);
                          }}
                          className={`rounded-lg border border-dashed p-1.5 transition-colors ${over === key ? "border-navy-m bg-navy-l/30" : "border-line/70"}`}
                        >
                          <div className="flex items-center gap-1.5 px-1 pb-1.5">
                            <span className={`chip ${cs.tone}`}>{cs.label}</span>
                            <span className="text-xs text-ink-2 tabular-nums">{sub.length}</span>
                          </div>
                          <ul className="flex min-h-10 flex-col gap-2">
                            {sub.map((r) => (
                              <Card key={r.id} r={r} team={team} onMove={move} />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {col.map((r) => (
                    <Card key={r.id} r={r} team={team} onMove={move} />
                  ))}
                </ul>
                )}
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

function Card({ r, team, onMove }: { r: RequestRow; team: Team; onMove: (id: string, to: string, reason?: string, status?: string) => void }) {
  const isNew = r.stage === "new";
  const late = isNew && minutesSince(r.createdAt) > FIRST_RESPONSE_SLA_MIN;
  const due = r.nextAlarmAt && new Date(r.nextAlarmAt) < new Date();
  const owner = team.find((u) => u.id === r.assignedTo);
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", r.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group cursor-grab rounded-lg border bg-white p-3 shadow-sm active:cursor-grabbing ${late ? "border-accent/50" : "border-line"}`}
    >
      <div className="flex items-start gap-2">
        <Link href={`/kisiler/${r.contactId}`} className="min-w-0 flex-1 text-sm font-medium leading-snug hover:underline">
          {r.fullName}
        </Link>
        {owner && (
          <span title={owner.name} className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-semibold text-cream">
            {initials(owner.name)}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-ink-2">
        {formatPhone(r.phone)}
        {r.lifecycle === "customer" && <span className="ml-1.5 font-medium text-emerald-700">· Müşteri</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="chip border-navy-l bg-[#eef1f8] text-navy">{productLabel(r.product)}</span>
        <span className="chip border-line bg-white text-ink-2">
          {r.source === "meta" && r.sourceDetail?.platform ? r.sourceDetail.platform : sourceLabel(r.source)}
        </span>
      </div>
      {(r.sourceDetail?.form || r.sourceDetail?.campaign) && (
        <div className="mt-1.5 truncate text-[11px] text-ink-2" title={[formLabel(r.sourceDetail.form), r.sourceDetail.campaign].filter(Boolean).join(" · ")}>
          📋 {formLabel(r.sourceDetail.form) ?? r.sourceDetail.campaign}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-2">
        <span className={late ? "font-semibold text-accent" : ""}>{ago(r.createdAt)}</span>
        {r.nextAlarmAt && <span className={due ? "font-semibold text-accent" : ""}>⏰ {ago(r.nextAlarmAt)}</span>}
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
        className="mt-2 w-full rounded-md border border-line bg-cream-l px-2 py-1 text-xs text-navy md:sr-only md:focus:not-sr-only"
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
