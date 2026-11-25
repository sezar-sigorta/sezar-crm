"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { openRequest } from "@/app/(app)/actions";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { CROSS_SELL, CROSS_SELL_CORPORATE, CROSS_SELL_REASONS, productLabel } from "@/lib/constants";

export type Suggestion = { product: string; reason: string; priority?: string };

/**
 * Products the customer doesn't have (and has no open request for).
 * "Teklif talebi aç" creates a request in Talepler (Arandı – Dönüş bekliyoruz) so it gets followed up.
 */
export function CrossSell({
  contactId,
  has,
  corporate,
  suggestions,
  title = "Ek satış fırsatları",
}: {
  contactId: string;
  has: string[];
  corporate?: boolean;
  /** AI suggestions; without them the standard list is shown. */
  suggestions?: Suggestion[];
  title?: string;
}) {
  const list: Suggestion[] =
    suggestions ??
    (corporate ? CROSS_SELL_CORPORATE : CROSS_SELL).filter((p) => !has.includes(p)).map((p) => ({ product: p, reason: CROSS_SELL_REASONS[p] ?? "" }));
  // Keep the list as first shown: after "Teklif talebi aç" the page refreshes and the product
  // counts as requested, but its row must stay to show the confirmation.
  const [items] = useState(list);
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription className="text-xs">&quot;Teklif talebi aç&quot; bu ürün için Talepler&apos;de takip edilecek bir kart açar.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="-my-2.5 divide-y">
          {items.map((s) => (
            <Row key={s.product} contactId={contactId} s={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Row({ contactId, s }: { contactId: string; s: Suggestion }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {productLabel(s.product)}
            {s.priority && (
              <Chip
                tone={
                  s.priority === "yüksek"
                    ? "border-orange-200 bg-orange-50 text-brand"
                    : s.priority === "orta"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-line text-ink-2"
                }
              >
                {s.priority}
              </Chip>
            )}
          </div>
          {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
        </div>
        {!result?.ok && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await openRequest(contactId, s.product);
                setResult(r && "error" in r && r.error ? { ok: false, text: r.error } : { ok: true, text: "Talep açıldı" });
              })
            }
          >
            <Plus data-icon="inline-start" />
            {pending ? "Açılıyor…" : "Teklif talebi aç"}
          </Button>
        )}
      </div>
      {result && (
        <p role="status" className={cn("mt-1.5 rounded-md px-2.5 py-1.5 text-xs", result.ok ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-brand")}>
          {result.ok ? (
            <>
              <Check className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
              {productLabel(s.product)} talebi açıldı: profilde &quot;Açık talepler&quot; altında ve{" "}
              <Link href="/talepler" className="font-medium underline">
                Talepler
              </Link>{" "}
              sayfasında &quot;Dönüş bekliyoruz&quot; grubunda.
            </>
          ) : (
            result.text
          )}
        </p>
      )}
    </li>
  );
}
