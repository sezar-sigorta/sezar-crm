"use client";

import { useState, useTransition } from "react";
import { whatsappMessage } from "@/app/(app)/actions";
import { Mail, Phone } from "lucide-react";
import { CUSTOMER_WHATSAPP_TEMPLATES, WHATSAPP_TEMPLATES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={`tel:+90${phone}`}>
          <Phone data-icon="inline-start" />
          Ara
        </a>
      </Button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" className="bg-wa text-white hover:bg-wa/90" disabled={pending}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-icon="inline-start">
              <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.3 11.3 0 01-4.5-4c-.3-.5-1-1.5-1-2.8s.7-2 .9-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.4z" />
            </svg>
            WhatsApp
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-1.5">
          {targets.length > 1 && (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Hangi {kind === "customer" ? "poliçe" : "talep"} için?
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={current?.key ?? ""} onValueChange={setPicked}>
                {targets.map((t) => (
                  // Keep the menu open: picking the target is a step before choosing a template.
                  <DropdownMenuRadioItem key={t.key} value={t.key} onSelect={(e) => e.preventDefault()} className="whitespace-normal">
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          {templates.map((t) => (
            <DropdownMenuItem key={t.id} onSelect={() => send(t.id)} className="flex-col items-start gap-0.5 px-2.5 py-2">
              <span className="text-sm font-medium">{t.label}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{t.text}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => send("")} className="px-2.5 py-2">
            Boş sohbet aç
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {email && (
        <Button asChild variant="outline">
          <a href={`mailto:${email}`}>
            <Mail data-icon="inline-start" />
            E-posta
          </a>
        </Button>
      )}
    </div>
  );
}
