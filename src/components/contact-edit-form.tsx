"use client";

import { useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import { updateContact } from "@/app/(app)/actions";
import type { Contact } from "@/db/schema";
import { formatPhone } from "@/lib/phone";
import { CorporateFields } from "./corporate-fields";

export function ContactEditForm({ c }: { c: Contact }) {
  const [state, onSubmit, pending] = useFormAction(updateContact);
  const [kind, setKind] = useState(c.kind === "kurumsal" ? "kurumsal" : "bireysel");
  const corp = kind === "kurumsal";
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="kind" value={kind} />
      <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Tür">
        {(["bireysel", "kurumsal"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-md px-3 py-1 text-xs ${kind === k ? "bg-navy text-cream" : "text-ink-2 hover:text-navy"}`}
          >
            {k === "bireysel" ? "Bireysel" : "Kurumsal"}
          </button>
        ))}
      </div>
      {corp && (
        <div className="grid grid-cols-2 gap-2">
          <CorporateFields c={c} idPrefix={`ed-${c.id.slice(0, 6)}`} />
        </div>
      )}
      <Field label={corp ? "Yetkili ad soyad" : "Ad soyad"} name="fullName" defaultValue={corp ? (c.contactPerson ?? c.fullName) : c.fullName} required />
      {corp && <Field label="Yetkilinin görevi" name="contactTitle" defaultValue={c.contactTitle ?? ""} />}
      <Field label={corp ? "Yetkili telefonu" : "Telefon"} name="phone" defaultValue={formatPhone(c.phone)} required inputMode="tel" />
      <Field label="E-posta" name="email" type="email" defaultValue={c.email ?? ""} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Şehir" name="city" defaultValue={c.city ?? ""} />
        {!corp && <Field label="Doğum tarihi" name="birthDate" type="date" defaultValue={c.birthDate ?? ""} />}
      </div>
      {c.lifecycle === "customer" && (
        <Field
          label="Müşteri olma tarihi"
          name="customerSince"
          type="date"
          defaultValue={c.customerSince ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(c.customerSince) : ""}
        />
      )}
      {!corp && <Field label="Meslek" name="occupation" defaultValue={c.occupation ?? ""} />}
      <Field label="Arama tercihi" name="preferredCallTime" defaultValue={c.preferredCallTime ?? ""} placeholder="ör. hafta içi akşam" />
      <div>
        <label className="label" htmlFor="notes">
          Notlar (profil)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={c.notes ?? ""}
          className="input resize-y"
          placeholder={corp ? "Şirket, filo, lokasyonlar gibi kalıcı bilgiler" : "Aile, araç, ev gibi kalıcı bilgiler"}
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-ink-2">
        <input type="checkbox" name="marketingConsent" defaultChecked={c.marketingConsent} className="mt-0.5 accent-navy" />
        Ticari ileti (kampanya) izni verdi
      </label>
      <div className="flex items-center justify-end gap-3">
        {state?.error && <span className="text-xs text-accent">{state.error}</span>}
        {state?.ok && <span className="text-xs text-emerald-700">Kaydedildi</span>}
        <button className="btn-primary" disabled={pending}>
          Kaydet
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
