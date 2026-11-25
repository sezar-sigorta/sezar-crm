"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { openRequest } from "@/app/(app)/actions";
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
    (corporate ? CROSS_SELL_CORPORATE : CROSS_SELL)
      .filter((p) => !has.includes(p))
      .map((p) => ({ product: p, reason: CROSS_SELL_REASONS[p] ?? "" }));
  // Keep the list as first shown: after "Teklif talebi aç" the page refreshes and the product
  // counts as requested, but its row must stay to show the confirmation.
  const [items] = useState(list);
  if (items.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-ink-2">"Teklif talebi aç" bu ürün için Talepler'de takip edilecek bir kart açar.</p>
      <ul className="mt-3 divide-y divide-line">
        {items.map((s) => (
          <Row key={s.product} contactId={contactId} s={s} />
        ))}
      </ul>
    </section>
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
              <span
                className={`chip ${s.priority === "yüksek" ? "border-orange-200 bg-orange-50 text-brand" : s.priority === "orta" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-line text-ink-2"}`}
              >
                {s.priority}
              </span>
            )}
          </div>
          {s.reason && <p className="text-xs text-ink-2">{s.reason}</p>}
        </div>
        {!result?.ok && (
          <button
            type="button"
            disabled={pending}
            className="btn-ghost shrink-0 px-2.5 py-1 text-xs"
            onClick={() =>
              start(async () => {
                const r = await openRequest(contactId, s.product);
                setResult(r && "error" in r && r.error ? { ok: false, text: r.error } : { ok: true, text: "Talep açıldı" });
              })
            }
          >
            {pending ? "Açılıyor…" : "Teklif talebi aç"}
          </button>
        )}
      </div>
      {result && (
        <p role="status" className={`mt-1.5 rounded-md px-2.5 py-1.5 text-xs ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-brand"}`}>
          {result.ok ? (
            <>
              ✓ {productLabel(s.product)} talebi açıldı: profilde "Açık talepler" altında ve{" "}
              <Link href="/talepler" className="font-medium underline">
                Talepler
              </Link>{" "}
              sayfasında "Dönüş bekliyoruz" grubunda.
            </>
          ) : (
            result.text
          )}
        </p>
      )}
    </li>
  );
}
