"use client";

import { useState, useTransition } from "react";
import { assignRequest, moveStage, setCallStatus, setRequestProduct, updateQuote } from "@/app/(app)/actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function RequestCard({ r, team }: { r: Request; team: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [lost, setLost] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closed = r.stage === "won" || r.stage === "lost";
  const answers = Object.entries(r.answers ?? {});
  const detail = Object.entries(r.sourceDetail ?? {}).filter(([k]) => DETAIL_LABELS[k]);

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

  return (
    <Card className="@container gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
        <h3 className="text-base font-semibold">
          <Select value={r.product} disabled={pending} onValueChange={(v) => start(() => setRequestProduct(r.id, v))}>
            <SelectTrigger
              aria-label="Ürün"
              title="Ürünü değiştir"
              className={cn(
                "-ml-1 h-auto cursor-pointer border-transparent px-1 py-0.5 font-display text-base font-semibold hover:bg-secondary",
                r.product === "genel" ? "text-brand ring-1 ring-brand/40" : "text-navy",
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
        <span className="text-xs text-muted-foreground">
          {r.segment === "kurumsal" ? "Kurumsal" : "Bireysel"} · {sourceLabel(r.source)} · {fmtDateTime(r.createdAt)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={pipelineValue(r.stage, r.callStatus)} disabled={pending} onValueChange={(v) => changeStage(v)}>
            <SelectTrigger size="sm" aria-label="Aşama" className={cn("h-6! rounded-full px-2.5 text-xs font-medium", STAGES.find((s) => s.code === r.stage)?.tone)}>
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
      </div>

      <div className="grid gap-4 p-4 @2xl:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Form cevapları</h4>
          {answers.length ? (
            <dl className="space-y-1 text-sm">
              {answers.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Cevap yok.</p>
          )}
          {detail.length > 0 && (
            <>
              <h4 className="mt-4 mb-1.5 text-xs font-medium text-muted-foreground">Kaynak detayı</h4>
              <dl className="space-y-1 text-sm">
                {detail.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <dt className="text-muted-foreground">{DETAIL_LABELS[k]}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`assignee-${r.id}`} className="text-xs font-normal text-muted-foreground">
                Sorumlu
              </Label>
              <Select defaultValue={r.assignedTo ?? NOBODY} onValueChange={(v) => start(() => assignRequest(r.id, v === NOBODY ? "" : v))}>
                <SelectTrigger id={`assignee-${r.id}`} className="w-full bg-card">
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
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`quote-${r.id}`} className="text-xs font-normal text-muted-foreground">
                Teklif tutarı (₺)
              </Label>
              <Input
                id={`quote-${r.id}`}
                defaultValue={r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : ""}
                inputMode="decimal"
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value;
                  const before = r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : "";
                  if (v !== before) start(() => updateQuote(r.id, v));
                }}
                className="bg-card"
              />
            </div>
          </div>

          {closed && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
              {r.stage === "won" ? "Kazanıldı" : `Kaybedildi: ${r.lostReason ?? "—"}`} · {fmtDateTime(r.closedAt)}
            </p>
          )}
          {err && <p className="text-sm text-brand">{err}</p>}
        </div>
      </div>
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
