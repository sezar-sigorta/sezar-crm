"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { assignRequest, moveStage, setCallStatus } from "@/app/(app)/actions";
import { FIRST_RESPONSE_SLA_MIN, PIPELINE_OPTIONS, STAGES, callStatus, formLabel, pipelineValue, productLabel } from "@/lib/constants";
import { ago, fmtDateTime, initials, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { SourceChip } from "./chips";
import { LostDialog } from "./lost-dialog";

type Team = { id: string; name: string }[];

/** Link that opens a lead in the side panel, keeping the current filters and view. */
export function useLeadHref() {
  const sp = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("lead", id);
    return `?${next.toString()}`;
  };
}

/** "Tablo görünümü" of the Lead Merkezi: one row per request, stage and owner editable in place. */
export function LeadTable({ rows, team, selected }: { rows: RequestRow[]; team: Team; selected?: string }) {
  const href = useLeadHref();
  const [items, setOptimistic] = useOptimistic(rows, (state, m: { id: string; stage?: string; callStatus?: string | null; assignedTo?: string | null }) =>
    state.map((r) => (r.id === m.id ? { ...r, ...m, stage: m.stage ?? r.stage } : r)),
  );
  const [, start] = useTransition();
  const [lost, setLost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function changeStage(id: string, value: string, reason?: string) {
    const [to, status] = value.split(":");
    if (to === "lost" && !reason) return setLost(id);
    setError(null);
    start(async () => {
      setOptimistic({ id, stage: to, callStatus: to === "followup" ? (status ?? "neutral") : null });
      try {
        if (to === "followup" && status) await setCallStatus(id, status);
        else {
          const res = await moveStage(id, to, reason);
          if (res && "error" in res && res.error) setError(res.error);
        }
      } catch {
        setError("Aşama değiştirilemedi, tekrar deneyin.");
      }
    });
  }

  function assign(id: string, userId: string) {
    start(async () => {
      setOptimistic({ id, assignedTo: userId || null });
      await assignRequest(id, userId);
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-accent/30 bg-orange-50 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Eklenme</th>
              <th className="px-3 py-2.5 font-medium">Ad</th>
              <th className="px-3 py-2.5 font-medium">Aşama</th>
              <th className="px-3 py-2.5 font-medium">Kaynak</th>
              <th className="px-3 py-2.5 font-medium">Reklam / form</th>
              <th className="px-3 py-2.5 font-medium">Ürün</th>
              <th className="px-3 py-2.5 font-medium">Atanan</th>
              <th className="px-4 py-2.5 font-medium">Hatırlatma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((r) => {
              const late = r.stage === "new" && minutesSince(r.createdAt) > FIRST_RESPONSE_SLA_MIN;
              const due = r.nextAlarmAt && new Date(r.nextAlarmAt) < new Date();
              const tone = r.stage === "followup" ? callStatus(r.callStatus)?.tone : STAGES.find((s) => s.code === r.stage)?.tone;
              const d = r.sourceDetail ?? {};
              // Meta: the ad, with its campaign underneath. Website: the form.
              const origin = r.source === "meta" ? (d.ad ?? d.adset ?? d.campaign) : (formLabel(d.form) ?? d.campaign);
              const originSub = r.source === "meta" ? (d.ad || d.adset ? d.campaign : formLabel(d.form)) : d.page;
              return (
                <tr key={r.id} className={r.id === selected ? "bg-navy-l/25" : "hover:bg-cream-l"}>
                  <td className={`px-4 py-2.5 whitespace-nowrap tabular-nums ${late ? "font-semibold text-accent" : "text-ink-2"}`} title={fmtDateTime(r.createdAt)}>
                    {ago(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={href(r.id)} scroll={false} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-[10px] font-semibold text-navy">{initials(r.fullName)}</span>
                      <span className="min-w-0">
                        <span className="block max-w-56 truncate">{r.fullName}</span>
                        <span className="block text-xs font-normal text-ink-2 tabular-nums">{formatPhone(r.phone)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <label className="sr-only" htmlFor={`tst-${r.id}`}>
                      Aşama
                    </label>
                    <select
                      id={`tst-${r.id}`}
                      value={pipelineValue(r.stage, r.callStatus)}
                      onChange={(e) => changeStage(r.id, e.target.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
                    >
                      {PIPELINE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceChip code={r.source} detail={r.sourceDetail} />
                  </td>
                  <td className="max-w-56 px-3 py-2.5" title={[d.campaign, d.adset, d.ad].filter(Boolean).join(" › ") || origin || undefined}>
                    <div className={`truncate ${r.source === "meta" ? "font-medium text-[#5b3a9b]" : "text-ink-2"}`}>{origin ?? "—"}</div>
                    {originSub && <div className="truncate text-xs text-ink-2">{originSub}</div>}
                  </td>
                  <td className={`px-3 py-2.5 ${r.product === "genel" ? "text-accent" : ""}`}>{productLabel(r.product)}</td>
                  <td className="px-3 py-2.5">
                    <label className="sr-only" htmlFor={`tas-${r.id}`}>
                      Atanan kişi
                    </label>
                    <select id={`tas-${r.id}`} value={r.assignedTo ?? ""} onChange={(e) => assign(r.id, e.target.value)} className="rounded-md border border-line bg-white px-2 py-1 text-xs">
                      <option value="">Atanmamış</option>
                      {team.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-4 py-2.5 text-xs whitespace-nowrap ${due ? "font-semibold text-accent" : "text-ink-2"}`}>
                    {r.nextAlarmAt ? `⏰ ${fmtDateTime(r.nextAlarmAt)}` : "—"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-2">
                  Bu filtrelerde lead yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {lost && (
        <LostDialog
          onCancel={() => setLost(null)}
          onConfirm={(reason) => {
            const id = lost;
            setLost(null);
            changeStage(id, "lost", reason);
          }}
        />
      )}
    </>
  );
}
