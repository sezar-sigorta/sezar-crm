"use client";

import { useState, useTransition } from "react";
import { addReminder, whatsappCustom } from "@/app/(app)/actions";
import { analyzeContact } from "@/app/(app)/ai-actions";
import { AlertCircle, AlarmClock, Check, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { ago, toLocalInput, todayYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "./chips";
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

  if (!enabled && !analysis)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        <span>
          AI analizi kapalı. Açmak için sunucuya <code className="font-mono">ANTHROPIC_API_KEY</code> eklenmeli.
        </span>
      </div>
    );

  return (
    <>
      <Card role="region" className="gap-0 pt-0" aria-labelledby="ai-h">
        <CardHeader className="border-b [.border-b]:pb-4">
          <CardTitle id="ai-h" className="flex items-center gap-1.5 font-display text-base font-semibold">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            AI analizi
          </CardTitle>
          {analyzedAt && <CardDescription className="text-xs">{ago(analyzedAt)}</CardDescription>}
          <CardAction>
            <Button type="button" variant="outline" size="xs" disabled={!enabled || pending} onClick={run}>
              {analysis && <RefreshCw data-icon="inline-start" className={cn(pending && "animate-spin")} />}
              {pending ? "Analiz ediliyor…" : analysis ? "Yenile" : "Analiz et"}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 text-sm">
          {!enabled && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              AI kapalı. Açmak için sunucuya <code className="font-mono">ANTHROPIC_API_KEY</code> eklenmeli.
            </p>
          )}
          {error && (
            <Alert variant="destructive" className="border-brand/40 text-brand">
              <AlertCircle />
              <AlertDescription className="text-brand">{error}</AlertDescription>
            </Alert>
          )}
          {!analysis && enabled && !pending && (
            <p className="text-muted-foreground">
              Poliçeler, talepler, form cevapları ve notlara bakıp özet, ihtiyaçlar, ek satış önerileri ve sıradaki adımı çıkarır. Ad, telefon, e-posta, vergi
              no ve adres gönderilmez.
            </p>
          )}
          {pending && !analysis && <p className="animate-pulse text-muted-foreground">Profil inceleniyor…</p>}

          {analysis && (
            <div className={pending ? "opacity-50" : ""}>
              <p className="leading-relaxed">{analysis.summary}</p>
              {analysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis.tags.map((t) => (
                    <Chip key={t} tone="text-muted-foreground">
                      {t}
                    </Chip>
                  ))}
                </div>
              )}

              {analysis.needs.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-1.5 font-sans text-sm font-medium">Muhtemel ihtiyaçlar</h3>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {analysis.needs.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-sans text-xs font-medium text-muted-foreground">Sıradaki adım</h3>
                  <Chip tone="text-muted-foreground">{analysis.next_action.when}</Chip>
                </div>
                <p className="mt-1 font-medium">{analysis.next_action.title}</p>
                <p className="text-xs text-muted-foreground">{analysis.next_action.detail}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={alarmSet}
                  className="mt-2"
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
                  {alarmSet ? <Check data-icon="inline-start" /> : <AlarmClock data-icon="inline-start" />}
                  {alarmSet ? "Alarm kuruldu" : "Alarm kur"}
                </Button>
              </div>

              <div className="mt-4 rounded-lg bg-muted/60 p-3">
                <h3 className="font-sans text-xs font-medium text-muted-foreground">Önerilen WhatsApp mesajı</h3>
                <p className="mt-1 whitespace-pre-wrap">{analysis.suggested_message}</p>
                <Button
                  type="button"
                  size="xs"
                  className="mt-2 bg-wa text-white hover:bg-wa/90"
                  onClick={() => {
                    const win = window.open("about:blank", "_blank");
                    start(async () => {
                      const { url } = await whatsappCustom(contactId, analysis.suggested_message);
                      if (win) win.location.href = url;
                      else window.location.href = url;
                    });
                  }}
                >
                  <MessageCircle data-icon="inline-start" />
                  WhatsApp&apos;ta aç
                </Button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {isCustomer ? "Kaybetme riski" : "Vazgeçme riski"}:{" "}
                <b
                  className={
                    analysis.churn_risk.level === "yüksek" ? "text-brand" : analysis.churn_risk.level === "orta" ? "text-amber-700" : "text-emerald-700"
                  }
                >
                  {analysis.churn_risk.level}
                </b>{" "}
                — {analysis.churn_risk.reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {analysis && analysis.cross_sell.length > 0 && (
        <CrossSell contactId={contactId} has={[]} suggestions={analysis.cross_sell} title="AI'ın önerdiği ürünler" />
      )}
    </>
  );
}
