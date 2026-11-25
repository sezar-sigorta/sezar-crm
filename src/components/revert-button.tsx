"use client";

import { useTransition } from "react";
import { revertToLead } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function RevertButton({ contactId }: { contactId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      disabled={pending}
      className="px-1 text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (confirm("Bu kişi Leadler listesine geri alınsın mı? Poliçeleri silinmez.")) start(() => revertToLead(contactId));
      }}
    >
      Lead&apos;e geri al
    </Button>
  );
}
