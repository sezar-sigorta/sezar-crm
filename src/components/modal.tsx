"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** shadcn Dialog shown while mounted; closing (✕, Esc, overlay) calls onClose. */
export function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto p-5", wide ? "sm:max-w-[640px]" : "sm:max-w-[440px]")}>
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          {sub ? <DialogDescription>{sub}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
