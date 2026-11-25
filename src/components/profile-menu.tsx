"use client";

import { useState, useTransition } from "react";
import { EllipsisIcon, UndoIcon, UserCheckIcon } from "lucide-react";
import { revertToLead } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConvertDialog } from "./convert-button";

/** "⋯" menu of the profile header: the less frequent, bigger actions. */
export function ProfileMenu({ contactId, name, customer, defaultProduct }: { contactId: string; name: string; customer: boolean; defaultProduct?: string }) {
  const [convert, setConvert] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Diğer işlemler" disabled={pending}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {customer ? (
            <DropdownMenuItem
              onSelect={() => {
                if (confirm("Bu kişi Leadler listesine geri alınsın mı? Poliçeleri silinmez.")) start(() => revertToLead(contactId));
              }}
            >
              <UndoIcon />
              Lead&apos;e geri al
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConvert(true)}>
              <UserCheckIcon />
              Müşteriye dönüştür
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {convert && <ConvertDialog contactId={contactId} name={name} defaultProduct={defaultProduct} onClose={() => setConvert(false)} />}
    </>
  );
}
