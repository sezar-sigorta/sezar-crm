"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";
import { convertToCustomer } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Modal } from "./modal";
import { PolicyFields } from "./policy-fields";
import { useFormAction } from "./use-form-action";

/** "Müşteriye dönüştür" button + dialog (optionally records the first policy). */
export function ConvertButton({
  contactId,
  name,
  defaultProduct,
  size = "md",
}: {
  contactId: string;
  name: string;
  defaultProduct?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {size === "sm" ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(true)}>
          Müşteriye dönüştür
        </Button>
      ) : (
        <Button type="button" className="bg-brand text-white hover:bg-brand/90" onClick={() => setOpen(true)}>
          <UserCheck data-icon="inline-start" />
          Müşteriye dönüştür
        </Button>
      )}
      {open && <ConvertDialog contactId={contactId} name={name} defaultProduct={defaultProduct} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ConvertDialog({ contactId, name, defaultProduct, onClose }: { contactId: string; name: string; defaultProduct?: string; onClose: () => void }) {
  const [state, formProps, pending] = useFormAction(convertToCustomer);
  const [withPolicy, setWithPolicy] = useState(true);
  const checkId = `cv-add-${contactId.slice(0, 6)}`;

  return (
    <Modal
      title={`${name} müşteri olsun`}
      sub="Kişi Müşteriler listesine geçer. Kesilen poliçeyi şimdi eklerseniz yenileme alarmları otomatik kurulur."
      onClose={onClose}
      wide
    >
      <form {...formProps} className="grid gap-4">
        <input type="hidden" name="contactId" value={contactId} />
        <Label htmlFor={checkId} className="cursor-pointer">
          {/* Posts addPolicy=on when checked, like the native checkbox did. */}
          <Checkbox id={checkId} name="addPolicy" checked={withPolicy} onCheckedChange={(v) => setWithPolicy(v === true)} />
          Kesilen poliçeyi şimdi ekle
        </Label>
        {withPolicy && <PolicyFields defaultProduct={defaultProduct} idPrefix={`cv-${contactId.slice(0, 6)}`} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state?.error && (
            <span role="alert" className="mr-auto text-sm text-brand">
              {state.error}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Müşteriye dönüştür"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
