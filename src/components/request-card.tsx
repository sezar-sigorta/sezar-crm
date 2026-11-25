"use client";

import { useState, useTransition } from "react";
import { ChevronRightIcon, UserRoundIcon } from "lucide-react";
import { assignRequest, moveStage, setCallStatus, setRequestProduct, updateQuote } from "@/app/(app)/actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Request } from "@/db/schema";
import { PIPELINE_OPTIONS, PRODUCTS, STAGES, pipelineValue, sourceLabel } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LostDialog } from "./lost-dialog";

const DETAIL_LABELS: Record<string, string> = {
  platform: "Platform",
  campaign: "Kampanya",
  adset: "Reklam seti",
  ad: "Reklam",
  form: "Form",
  page: "Sayfa",
};

/** Radix Select can't hold "", so "Atanmamış" uses this value in the UI and "" towards the server. */
const NOBODY = "none";

export function RequestCard({ r, team, defaultOpen = false }: { r: Request; team: { id: string; name: string }[]; defaultOpen?: boolean }) {
  const [pending, start] = useTransition();
  const [lost, setLost] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closed = r.stage === "won" || r.stage === "lost";
  const answers = Object.entries(r.answers ?? {});
  // Source details, minus what the form answers already say (e.g. the form name).
  const said = new Set(answers.map(([, v]) => String(v)));
  const detail = Object.entries(r.sourceDetail ?? {})
    .filter(([k, v]) => DETAIL_LABELS[k] && !said.has(String(v)))
    .map(([k, v]) => [DETAIL_LABELS[k], v] as [string, string]);
  const [open, setOpen] = useState(defaultOpen);

  function changeStage(value: string, reason?: string) {
    const [to, status] = value.split(":");
    if (to === "lost" && !reason) return setLost(true);
    setErr(null);
    start(async () => {
      if (to === "followup" && status) return void (await setCallStatus(r.id, status));
      const res = await moveStage(r.id, to, reason);
      if (res && "error" in res && res.error) setErr(res.error);
    });
  }

  const assignee = (
    <Select defaultValue={r.assignedTo ?? NOBODY} onValueChange={(v) => start(() => assignRequest(r.id, v === NOBODY ? "" : v))}>
      <SelectTrigger size="sm" aria-label="Sorumlu" className="w-auto max-w-44">
        <UserRoundIcon className="text-muted-foreground" />
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
  );

  return (
    <Card className="@container gap-0 py-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-controls={`req-${r.id}`}
          aria-label={open ? "Detayı gizle" : "Detayı göster"}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-sm font-medium">
            <Select value={r.product} disabled={pending} onValueChange={(v) => start(() => setRequestProduct(r.id, v))}>
              <SelectTrigger
                aria-label="Ürün"
                title="Ürünü değiştir"
                className={cn(
                  "-ml-1 h-auto cursor-pointer border-transparent px-1 py-0 text-sm font-medium shadow-none hover:bg-muted",
                  r.product === "genel" && "text-brand",
                )}
              >
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
          </h3>
          <span className="truncate text-xs text-muted-foreground">
            {r.segment === "kurumsal" ? "Kurumsal" : "Bireysel"} · {sourceLabel(r.source)} · {fmtDateTime(r.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignee}
          <div className="relative w-28">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
            <Input
              aria-label="Teklif tutarı (₺)"
              defaultValue={r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : ""}
              inputMode="decimal"
              placeholder="Teklif"
              onBlur={(e) => {
                const v = e.target.value;
                const before = r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : "";
                if (v !== before) start(() => updateQuote(r.id, v));
              }}
              className="h-7 pl-6 text-sm"
            />
          </div>
          <Select value={pipelineValue(r.stage, r.callStatus)} disabled={pending} onValueChange={(v) => changeStage(v)}>
            <SelectTrigger size="sm" aria-label="Aşama" className={cn("h-7! rounded-full px-2.5 text-xs font-medium", STAGES.find((s) => s.code === r.stage)?.tone)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PIPELINE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(closed || err) && (
          <p className={cn("w-full pl-10 text-xs", err ? "text-destructive" : "text-muted-foreground")}>
            {err ?? `${r.stage === "won" ? "Kazanıldı" : `Kaybedildi: ${r.lostReason ?? "—"}`} · ${fmtDateTime(r.closedAt)}`}
          </p>
        )}
      </div>

      {open && (
        <div id={`req-${r.id}`} className="grid gap-x-8 gap-y-4 border-t px-4 py-4 @lg:pl-13 @2xl:grid-cols-2">
          <Facts title="Form cevapları" rows={answers} empty="Cevap yok." />
          {detail.length > 0 && <Facts title="Kaynak" rows={detail} />}
        </div>
      )}
      {lost && (
        <LostDialog
          onCancel={() => setLost(false)}
          onConfirm={(reason) => {
            setLost(false);
            changeStage("lost", reason);
          }}
        />
      )}
    </Card>
  );
}

function Facts({ title, rows, empty }: { title: string; rows: [string, unknown][]; empty?: string }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h4>
      {rows.length ? (
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
