"use client";

import { useEffect, useRef, useState } from "react";
import { LOST_REASONS } from "@/lib/constants";

export function LostDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-xl border border-line bg-white p-0 text-navy backdrop:bg-navy/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason) onConfirm(reason);
        }}
        className="p-5"
      >
        <h2 className="text-lg font-semibold">Neden kaybedildi?</h2>
        <p className="mt-1 text-sm text-ink-2">Raporlarda hangi reklamın ve ürünün neden kaybettirdiğini görmek için.</p>
        <div className="mt-4 grid gap-1.5">
          {LOST_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reason === r ? "border-navy bg-cream" : "border-line"}`}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-navy" />
              {r}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Vazgeç
          </button>
          <button className="btn-primary" disabled={!reason}>
            Kaybedildi olarak işaretle
          </button>
        </div>
      </form>
    </dialog>
  );
}
