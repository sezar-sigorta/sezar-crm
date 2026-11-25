"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type PullMetaResult, pullMetaLeads } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

function summary(res: PullMetaResult) {
  return res.ok
    ? `${res.forms} form, ${res.found} lead: ${res.imported} yeni eklendi, ${res.known} zaten vardı${res.failed ? `, ${res.failed} hatalı (aşağıdaki listede)` : ""}.`
    : `Hata: ${res.error}`;
}

export function PullMetaButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<PullMetaResult | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await pullMetaLeads();
            setRes(r);
            if (r.ok) toast.success("Meta lead'leri kontrol edildi", { description: summary(r) });
            else toast.error("Meta'dan çekilemedi", { description: r.error });
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        {pending ? "Çekiliyor…" : "Meta'dan çek"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {res == null ? "Son 90 günün form lead'lerini kontrol eder; CRM'de olanları tekrar eklemez." : summary(res)}
      </span>
    </div>
  );
}
