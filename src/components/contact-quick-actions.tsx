"use client";

import { useState, useTransition } from "react";
import { whatsappMessage } from "@/app/(app)/actions";
import { CUSTOMER_WHATSAPP_TEMPLATES, WHATSAPP_TEMPLATES } from "@/lib/constants";

export type WaTarget = { key: string; label: string; requestId?: string; policyId?: string; product?: string };

/** CTA row: call, WhatsApp (with message templates), e-mail. */
export function ContactQuickActions({
  contactId,
  phone,
  email,
  kind,
  targets,
}: {
  contactId: string;
  phone: string;
  email: string | null;
  kind: "lead" | "customer";
  /** What the message is about: open requests (lead) or policies / products (customer). */
  targets: WaTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(targets[0]?.key ?? "");
  // The list changes after a lead becomes a customer: fall back to the first valid target.
  const current = targets.find((x) => x.key === picked) ?? targets[0];
  const [pending, start] = useTransition();
  const templates = kind === "customer" ? CUSTOMER_WHATSAPP_TEMPLATES : WHATSAPP_TEMPLATES;

  function send(template: string) {
    // Open the tab synchronously (popup blockers), then point it at wa.me once the message is logged.
    const win = window.open("about:blank", "_blank");
    const t = current;
    start(async () => {
      const { url } = await whatsappMessage(contactId, { requestId: t?.requestId, policyId: t?.policyId, product: t?.product }, template);
      if (win) win.location.href = url;
      else window.location.href = url;
      setOpen(false);
    });
  }

  return (
    <div className="relative flex flex-wrap gap-2">
      <a href={`tel:+90${phone}`} className="btn-ghost">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
        </svg>
        Ara
      </a>
      <button type="button" className="btn-wa" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={pending}>
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.3 11.3 0 01-4.5-4c-.3-.5-1-1.5-1-2.8s.7-2 .9-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.4z" />
        </svg>
        WhatsApp
      </button>
      {email && (
        <a href={`mailto:${email}`} className="btn-ghost">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h16v16H4zM4 6l8 7 8-7" />
          </svg>
          E-posta
        </a>
      )}
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-line bg-white p-2 shadow-xl">
          {targets.length > 1 && (
            <label className="mb-2 block px-2 pt-1 text-xs text-ink-2">
              Hangi {kind === "customer" ? "poliçe" : "talep"} için?
              <select value={current?.key ?? ""} onChange={(e) => setPicked(e.target.value)} className="input mt-1">
                {targets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul>
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => send(t.id)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-cream">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="line-clamp-2 text-xs text-ink-2">{t.text}</div>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => send("")} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-cream">
                Boş sohbet aç
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
