"use client";

import { useEffect, useRef } from "react";

/** Native <dialog> shown as a modal while mounted. */
export function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto max-h-[90dvh] rounded-xl border border-line bg-white p-0 text-navy backdrop:bg-navy/40"
      style={{ width: `min(${wide ? 640 : 440}px, calc(100vw - 32px))` }}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-ink-2 hover:bg-cream" aria-label="Kapat">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
