"use client";

import { useState } from "react";
import { LOST_REASONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function LostDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="p-5 sm:max-w-[420px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) onConfirm(reason);
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Neden kaybedildi?</DialogTitle>
            <DialogDescription>Raporlarda hangi reklamın ve ürünün neden kaybettirdiğini görmek için.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="gap-1.5">
            {LOST_REASONS.map((r, i) => (
              <Label
                key={r}
                htmlFor={`lost-${i}`}
                className={cn(
                  "cursor-pointer gap-2 rounded-lg border px-3 py-2 font-normal",
                  reason === r ? "border-primary bg-secondary" : "border-border hover:bg-secondary/50",
                )}
              >
                <RadioGroupItem id={`lost-${i}`} value={r} />
                {r}
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={!reason}>
              Kaybedildi olarak işaretle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
