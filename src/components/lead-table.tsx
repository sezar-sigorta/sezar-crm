"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { assignRequest, moveStage, setCallStatus } from "@/app/(app)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIRST_RESPONSE_SLA_MIN, PIPELINE_OPTIONS, STAGES, callStatus, formLabel, pipelineValue, productLabel } from "@/lib/constants";
import { ago, fmtDateTime, initials, minutesSince } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { SourceChip } from "./chips";
import { LostDialog } from "./lost-dialog";

type Team = { id: string; name: string }[];

/** Radix Select can't hold "", so "Atanmamış" uses this value in the UI and "" towards the server. */
const NOBODY = "none";

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
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <Table className="min-w-[1040px]">
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Eklenme</TableHead>
              <TableHead className="px-3">Ad</TableHead>
              <TableHead className="px-3">Aşama</TableHead>
              <TableHead className="px-3">Kaynak</TableHead>
              <TableHead className="px-3">Reklam / form</TableHead>
              <TableHead className="px-3">Ürün</TableHead>
              <TableHead className="px-3">Atanan</TableHead>
              <TableHead className="pr-4">Hatırlatma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => {
              const late = r.stage === "new" && minutesSince(r.createdAt) > FIRST_RESPONSE_SLA_MIN;
              const due = r.nextAlarmAt && new Date(r.nextAlarmAt) < new Date();
              const tone = r.stage === "followup" ? callStatus(r.callStatus)?.tone : STAGES.find((s) => s.code === r.stage)?.tone;
              const d = r.sourceDetail ?? {};
              // Meta: the ad, with its campaign underneath. Website: the form.
              const origin = r.source === "meta" ? (d.ad ?? d.adset ?? d.campaign) : (formLabel(d.form) ?? d.campaign);
              const originSub = r.source === "meta" ? (d.ad || d.adset ? d.campaign : formLabel(d.form)) : d.page;
              return (
                <TableRow key={r.id} data-state={r.id === selected ? "selected" : undefined} className="data-[state=selected]:bg-muted">
                  <TableCell className={cn("py-2.5 pl-4 tabular-nums", late ? "font-semibold text-brand" : "text-muted-foreground")} title={fmtDateTime(r.createdAt)}>
                    {ago(r.createdAt)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Link href={href(r.id)} scroll={false} className="flex items-center gap-2 font-medium hover:underline">
                      <Avatar size="sm" className="size-7">
                        <AvatarFallback className="text-[10px]">{initials(r.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block max-w-56 truncate">{r.fullName}</span>
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums">{formatPhone(r.phone)}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Select value={pipelineValue(r.stage, r.callStatus)} onValueChange={(v) => changeStage(r.id, v)}>
                      <SelectTrigger size="sm" aria-label="Aşama" className={cn("h-6! rounded-full px-2.5 text-xs font-medium", tone)}>
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
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <SourceChip code={r.source} detail={r.sourceDetail} />
                  </TableCell>
                  <TableCell className="max-w-56 px-3 py-2.5" title={[d.campaign, d.adset, d.ad].filter(Boolean).join(" › ") || origin || undefined}>
                    <div className={cn("truncate", r.source === "meta" ? "font-medium" : "text-muted-foreground")}>{origin ?? "—"}</div>
                    {originSub && <div className="truncate text-xs text-muted-foreground">{originSub}</div>}
                  </TableCell>
                  <TableCell className={cn("px-3 py-2.5", r.product === "genel" && "text-brand")}>{productLabel(r.product)}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Select value={r.assignedTo ?? NOBODY} onValueChange={(v) => assign(r.id, v === NOBODY ? "" : v)}>
                      <SelectTrigger size="sm" aria-label="Atanan kişi" className="h-7 min-w-32 text-xs">
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
                  </TableCell>
                  <TableCell className={cn("py-2.5 pr-4 text-xs", due ? "font-semibold text-brand" : "text-muted-foreground")}>
                    {r.nextAlarmAt ? (
                      <span className="inline-flex items-center gap-1">
                        <BellIcon className="size-3" aria-hidden="true" />
                        {fmtDateTime(r.nextAlarmAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Bu filtrelerde lead yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
