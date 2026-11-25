"use client";

import { BellIcon, MegaphoneIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage, setCallStatus } from "@/app/(app)/actions";
import { CALL_STATUSES, FIRST_RESPONSE_SLA_MIN, PIPELINE_OPTIONS, STAGES, formLabel, pipelineValue, productLabel, platformLabel, sourceLabel } from "@/lib/constants";
import { ago, fmtDateTime, initials, minutesSince, nearAlarmLabel } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-6 lg:px-6">
        <div className="grid min-w-[980px] grid-cols-[1fr_1.2fr_1fr_1fr] gap-3">
          {STAGES.map((s) => {
            const col = items.filter((r) => r.stage === s.code);
            const meta = COLUMN[s.code];
            return (
              <section
                key={s.code}
                role="region"
                aria-label={s.label}
                {...dropProps(s.code, (id) => move(id, s.code))}
                onDragLeave={() => setOver((o) => (o === s.code ? null : o))}
                className={cn(
                  "flex max-h-[calc(100dvh-180px)] min-h-[60vh] min-w-0 flex-col rounded-xl border bg-muted/70 transition-colors",
                  over === s.code ? "bg-muted ring-2 ring-ring/50" : dragging && "ring-1 ring-border ring-dashed",
                )}
              >
                <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-medium">
                  <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
                  {meta.title}
                  <Badge variant="secondary" className="ml-auto bg-background tabular-nums">
                    {col.length}
                  </Badge>
                </h2>
                <div className="flex-1 overflow-y-auto px-2 pb-2">
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
                            className={cn("rounded-lg transition-colors", over === key && "bg-background/60 ring-2 ring-ring/50")}
                          >
                            <div className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-muted-foreground">
                              <span className={cn("size-1.5 rounded-full", SUB_DOT[cs.code])} aria-hidden="true" />
                              {cs.label}
                              <span className="tabular-nums">· {sub.length}</span>
                            </div>
                            <ul className="flex min-h-8 flex-col gap-2 pt-1">
                              {sub.map((r) => (
                                <LeadCard key={r.id} r={r} {...cardProps} />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {col.map((r) => (
                        <LeadCard key={r.id} r={r} {...cardProps} />
                      ))}
                      {col.length === 0 && <li className="px-2 py-8 text-center text-xs text-muted-foreground">Buraya sürükleyin</li>}
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

const SOURCE_DOT: Record<string, string> = { meta: "bg-chart-3", website: "bg-chart-1" };

function LeadCard({
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
  const source = r.source === "meta" && r.sourceDetail?.platform ? platformLabel(r.sourceDetail.platform) : sourceLabel(r.source);
  const origin = [formLabel(r.sourceDetail?.form), r.sourceDetail?.campaign].filter(Boolean).join(" · ");

  return (
    <li>
      <Card
        size="sm"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", r.id);
          e.dataTransfer.effectAllowed = "move";
          onDrag(true);
        }}
        onDragEnd={() => onDrag(false)}
        className="group relative cursor-grab gap-0 p-3 shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing"
      >
        <div className="flex items-start gap-2.5">
          <Avatar>
            <AvatarFallback className="text-xs">{initials(r.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={leadHref(r.id)} scroll={false} className="truncate text-sm font-medium after:absolute after:inset-0 hover:underline" title={r.fullName}>
                {r.fullName}
              </Link>
              {r.lifecycle === "customer" && (
                <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                  Müşteri
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" title={origin || undefined}>
              <span className={cn("truncate", r.product === "genel" ? "font-medium text-brand" : "text-foreground")}>
                {r.product === "genel" ? "Ürün seçilmedi" : productLabel(r.product)}
              </span>
              <span aria-hidden="true">·</span>
              <span className={cn("size-1.5 shrink-0 rounded-full", SOURCE_DOT[r.source] ?? "bg-stone-400")} aria-hidden="true" />
              <span className="truncate">{source}</span>
            </div>
            {ad && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={`Reklam: ${adPath}`}>
                <MegaphoneIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{ad}</span>
              </div>
            )}
          </div>
          {owner ? (
            <Avatar size="sm" title={`Atanan: ${owner.name}`}>
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{initials(owner.name)}</AvatarFallback>
            </Avatar>
          ) : (
            <Avatar size="sm" title="Atanmamış" className="after:border-dashed">
              <AvatarFallback className="bg-transparent text-[10px] text-muted-foreground">?</AvatarFallback>
            </Avatar>
          )}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs whitespace-nowrap">
          <span className="truncate text-muted-foreground" title={fmtDateTime(r.createdAt)}>
            {ago(r.createdAt, now)}
          </span>
          {late && (
            <Badge variant="outline" className="h-5 border-brand/30 px-1.5 text-brand">
              Gecikti
            </Badge>
          )}
          {alarm && alarmText && (
            <Badge
              variant="outline"
              title={`Hatırlatma: ${fmtDateTime(alarm)}`}
              className={cn("h-5 px-1.5", due ? "border-brand/30 text-brand" : "border-transparent px-0 font-normal text-muted-foreground")}
            >
              <BellIcon aria-hidden="true" />
              {alarmText}
            </Badge>
          )}
          {/* Quick actions: on hover (always visible on touch screens). Above the card-wide link. */}
          <span className="relative z-10 ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <a href={`tel:+90${r.phone}`} title={`Ara: ${formatPhone(r.phone)}`} aria-label={`${r.fullName} kişisini ara`} className="grid size-6 place-items-center rounded-md text-foreground hover:bg-muted">
              <PhoneIcon className="size-3.5" aria-hidden="true" />
            </a>
            <a href={whatsappLink(r.phone)} target="_blank" rel="noreferrer" title="WhatsApp" aria-label={`${r.fullName} kişisine WhatsApp`} className="grid size-6 place-items-center rounded-md text-wa hover:bg-muted">
              <MessageCircleIcon className="size-3.5" aria-hidden="true" />
            </a>
          </span>
        </div>

        {/* Keyboard / touch alternative to drag-and-drop */}
        <Select
          value={pipelineValue(r.stage, r.callStatus)}
          onValueChange={(v) => {
            const [stage, status] = v.split(":");
            onMove(r.id, stage, undefined, status);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Aşama"
            className="relative z-10 mt-2 h-7 w-full text-xs md:sr-only md:focus:not-sr-only md:data-[state=open]:not-sr-only"
          >
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
      </Card>
    </li>
  );
}
