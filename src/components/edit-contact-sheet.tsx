"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import type { Contact } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContactEditForm } from "./contact-edit-form";

/** "Düzenle" on the details card: the full profile form in a side panel. */
export function EditContactSheet({ c }: { c: Contact }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <PencilIcon data-icon="inline-start" />
          Düzenle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Profil bilgileri</SheetTitle>
          <SheetDescription>{c.fullName}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ContactEditForm c={c} onSaved={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
