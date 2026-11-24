"use client";

import { useState, useTransition } from "react";
import { type PullMetaResult, pullMetaLeads } from "@/app/(app)/actions";

export function PullMetaButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<PullMetaResult | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => start(async () => setRes(await pullMetaLeads()))}
      >
        {pending ? "Çekiliyor…" : "Meta'dan çek"}
      </button>
      <span className="text-xs text-ink-2">
        {res == null
          ? "Son 90 günün form lead'lerini kontrol eder; CRM'de olanları tekrar eklemez."
          : res.ok
            ? `${res.forms} form, ${res.found} lead: ${res.imported} yeni eklendi, ${res.known} zaten vardı${res.failed ? `, ${res.failed} hatalı (aşağıdaki listede)` : ""}.`
            : `Hata: ${res.error}`}
      </span>
    </div>
  );
}
