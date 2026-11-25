"use client";

import { useState, useTransition } from "react";
import { assignRequest, moveStage, setCallStatus, setRequestProduct, updateQuote } from "@/app/(app)/actions";
import type { Request } from "@/db/schema";
import { PIPELINE_OPTIONS, PRODUCTS, STAGES, pipelineValue, sourceLabel } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { LostDialog } from "./lost-dialog";

const DETAIL_LABELS: Record<string, string> = {
  platform: "Platform",
  campaign: "Kampanya",
  adset: "Reklam seti",
  ad: "Reklam",
  form: "Form",
  page: "Sayfa",
};

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
    <article className="card @container overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-cream-l px-4 py-3">
        <h3 className="text-base font-semibold">
          <label className="sr-only" htmlFor={`product-${r.id}`}>
            Ürün
          </label>
          <select
            id={`product-${r.id}`}
            value={r.product}
            disabled={pending}
            title="Ürünü değiştir"
            onChange={(e) => start(() => setRequestProduct(r.id, e.target.value))}
            className={`-ml-1 cursor-pointer rounded-md bg-transparent px-1 py-0.5 font-display text-base font-semibold hover:bg-cream ${
              r.product === "genel" ? "text-brand ring-1 ring-brand/40" : "text-navy"
            }`}
          >
            {PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code === "genel" ? "Ürün seçin…" : p.label}
              </option>
            ))}
          </select>
        </h3>
        <span className="text-xs text-ink-2">
          {r.segment === "kurumsal" ? "Kurumsal" : "Bireysel"} · {sourceLabel(r.source)} · {fmtDateTime(r.createdAt)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor={`stage-${r.id}`}>
            Aşama
          </label>
          <select
            id={`stage-${r.id}`}
            value={pipelineValue(r.stage, r.callStatus)}
            disabled={pending}
            onChange={(e) => changeStage(e.target.value)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STAGES.find((s) => s.code === r.stage)?.tone}`}
          >
            {PIPELINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 p-4 @2xl:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-1.5 text-xs font-medium text-ink-2">Form cevapları</h4>
          {answers.length ? (
            <dl className="space-y-1 text-sm">
              {answers.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-2">Cevap yok.</p>
          )}
          {detail.length > 0 && (
            <>
              <h4 className="mb-1.5 mt-4 text-xs font-medium text-ink-2">Kaynak detayı</h4>
              <dl className="space-y-1 text-sm">
                {detail.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <dt className="text-ink-2">{DETAIL_LABELS[k]}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-2">
              Sorumlu
              <select
                defaultValue={r.assignedTo ?? ""}
                onChange={(e) => start(() => assignRequest(r.id, e.target.value))}
                className="input mt-1"
              >
                <option value="">Atanmamış</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-2">
              Teklif tutarı (₺)
              <input
                defaultValue={r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : ""}
                inputMode="decimal"
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value;
                  const before = r.quoteAmount ? Number(r.quoteAmount).toLocaleString("tr-TR") : "";
                  if (v !== before) start(() => updateQuote(r.id, v));
                }}
                className="input mt-1"
              />
            </label>
          </div>

          {closed && (
            <p className="rounded-lg bg-cream px-3 py-2 text-sm">
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
    </article>
  );
}
