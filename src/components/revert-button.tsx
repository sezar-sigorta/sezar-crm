"use client";

import { useTransition } from "react";
import { revertToLead } from "@/app/(app)/actions";

export function RevertButton({ contactId }: { contactId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-ink-2 underline-offset-2 hover:text-navy hover:underline"
      onClick={() => {
        if (confirm("Bu kişi Leadler listesine geri alınsın mı? Poliçeleri silinmez.")) start(() => revertToLead(contactId));
      }}
    >
      Lead'e geri al
    </button>
  );
}
