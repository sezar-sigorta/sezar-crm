"use client";

import { useState } from "react";
import { convertToCustomer } from "@/app/(app)/actions";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={size === "sm" ? "btn-ghost px-2.5 py-1 text-xs whitespace-nowrap" : "btn-accent"}
      >
        Müşteriye dönüştür
      </button>
      {open && <ConvertDialog contactId={contactId} name={name} defaultProduct={defaultProduct} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConvertDialog({ contactId, name, defaultProduct, onClose }: { contactId: string; name: string; defaultProduct?: string; onClose: () => void }) {
  const [state, formProps, pending] = useFormAction(convertToCustomer);
  const [withPolicy, setWithPolicy] = useState(true);

  return (
    <Modal title={`${name} müşteri olsun`} sub="Kişi Müşteriler listesine geçer. Kesilen poliçeyi şimdi eklerseniz yenileme alarmları otomatik kurulur." onClose={onClose} wide>
      <form {...formProps} className="space-y-4">
        <input type="hidden" name="contactId" value={contactId} />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="addPolicy" checked={withPolicy} onChange={(e) => setWithPolicy(e.target.checked)} className="accent-navy" />
          Kesilen poliçeyi şimdi ekle
        </label>
        {withPolicy && <PolicyFields defaultProduct={defaultProduct} idPrefix={`cv-${contactId.slice(0, 6)}`} />}
        <div className="flex items-center justify-end gap-2">
          {state?.error && (
            <span role="alert" className="mr-auto text-sm text-accent">
              {state.error}
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn-primary" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Müşteriye dönüştür"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
