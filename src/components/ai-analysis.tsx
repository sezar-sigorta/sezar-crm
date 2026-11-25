"use client";

import { useState, useTransition } from "react";
import { addReminder, whatsappCustom } from "@/app/(app)/actions";
import { analyzeContact } from "@/app/(app)/ai-actions";
import { ago, toLocalInput, todayYmd } from "@/lib/format";
import { CrossSell } from "./cross-sell";

type Analysis = {
  summary: string;
  tags: string[];
  needs: string[];
  cross_sell: { product: string; reason: string; priority: string }[];
  next_action: { title: string; when: string; detail: string };
  churn_risk: { level: string; reason: string };
  suggested_message: string;
};

const WHEN_DAYS: Record<string, number> = { bugün: 0, "bu hafta": 2, "bu ay": 7, "yenileme öncesi": 14 };

export function AiAnalysis({
  contactId,
  analysis,
  analyzedAt,
  enabled,
  isCustomer,
}: {
  contactId: string;
  analysis: Analysis | null;
  analyzedAt: Date | null;
  enabled: boolean;
  isCustomer: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alarmSet, setAlarmSet] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      const r = await analyzeContact(contactId);
      if ("error" in r) setError(r.error);
      setAlarmSet(false);
    });

  return (
    <>
      <section className="card overflow-hidden" aria-labelledby="ai-h">
        <div className="flex items-center gap-2 border-b border-line bg-gradient-to-r from-[#f4effd] to-white px-5 py-3.5">
          <h2 id="ai-h" className="text-base font-semibold">
            ✨ AI analizi
          </h2>
          {analyzedAt && <span className="text-xs text-ink-2">{ago(analyzedAt)}</span>}
          <button type="button" className="btn-ghost ml-auto px-2.5 py-1 text-xs" disabled={!enabled || pending} onClick={run}>
            {pending ? "Analiz ediliyor…" : analysis ? "Yenile" : "Analiz et"}
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {!enabled && (
            <p className="rounded-lg bg-cream px-3 py-2 text-xs text-ink-2">
              AI kapalı. Açmak için sunucuya <code className="font-mono">ANTHROPIC_API_KEY</code> eklenmeli.
            </p>
          )}
          {error && (
            <p role="alert" className="text-brand">
              {error}
            </p>
          )}
          {!analysis && enabled && !pending && (
            <p className="text-ink-2">
              Poliçeler, talepler, form cevapları ve notlara bakıp özet, ihtiyaçlar, ek satış önerileri ve sıradaki adımı çıkarır. Ad, telefon, e-posta, vergi no ve adres gönderilmez.
            </p>
          )}
          {pending && !analysis && <p className="animate-pulse text-ink-2">Profil inceleniyor…</p>}

          {analysis && (
            <div className={pending ? "opacity-50" : ""}>
              <p className="leading-relaxed">{analysis.summary}</p>
              {analysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis.tags.map((t) => (
                    <span key={t} className="chip border-[#d9c9f5] bg-[#f4effd] text-[#5b3a9b]">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {analysis.needs.length > 0 && (
                <div className="mt-4">
                  <h3 className="label">Muhtemel ihtiyaçlar</h3>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {analysis.needs.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-medium text-ink-2">Sıradaki adım</h3>
                  <span className="chip border-navy-l bg-[#eef1f8] text-navy">{analysis.next_action.when}</span>
                </div>
                <p className="mt-1 font-medium">{analysis.next_action.title}</p>
                <p className="text-xs text-ink-2">{analysis.next_action.detail}</p>
                <button
                  type="button"
                  disabled={alarmSet}
                  className="btn-ghost mt-2 px-2.5 py-1 text-xs"
                  onClick={() =>
                    start(async () => {
                      const days = WHEN_DAYS[analysis.next_action.when] ?? 1;
                      const at = days === 0 ? new Date(Date.now() + 3600e3) : new Date(`${todayYmd(new Date(Date.now() + days * 864e5))}T10:00:00+03:00`);
                      const fd = new FormData();
                      fd.set("contactId", contactId);
                      fd.set("at", toLocalInput(at));
                      fd.set("title", analysis.next_action.title);
                      const r = await addReminder(null, fd);
                      if (r && "ok" in r) setAlarmSet(true);
                    })
                  }
                >
                  {alarmSet ? "✓ Alarm kuruldu" : "Alarm kur"}
                </button>
              </div>

              <div className="mt-4 rounded-lg bg-cream-l p-3">
                <h3 className="text-xs font-medium text-ink-2">Önerilen WhatsApp mesajı</h3>
                <p className="mt-1 whitespace-pre-wrap">{analysis.suggested_message}</p>
                <button
                  type="button"
                  className="btn-wa mt-2 px-2.5 py-1 text-xs"
                  onClick={() => {
                    const win = window.open("about:blank", "_blank");
                    start(async () => {
                      const { url } = await whatsappCustom(contactId, analysis.suggested_message);
                      if (win) win.location.href = url;
                      else window.location.href = url;
                    });
                  }}
                >
                  WhatsApp'ta aç
                </button>
              </div>

              <p className="mt-3 text-xs text-ink-2">
                {isCustomer ? "Kaybetme riski" : "Vazgeçme riski"}:{" "}
                <b className={analysis.churn_risk.level === "yüksek" ? "text-brand" : analysis.churn_risk.level === "orta" ? "text-amber-700" : "text-emerald-700"}>
                  {analysis.churn_risk.level}
                </b>{" "}
                — {analysis.churn_risk.reason}
              </p>
            </div>
          )}
        </div>
      </section>

      {analysis && analysis.cross_sell.length > 0 && (
        <CrossSell contactId={contactId} has={[]} suggestions={analysis.cross_sell} title="AI'ın önerdiği ürünler" />
      )}
    </>
  );
}
