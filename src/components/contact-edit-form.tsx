"use client";

import { useEffect, useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import { updateContact } from "@/app/(app)/actions";
import type { Contact } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPhone } from "@/lib/phone";
import { CorporateFields } from "./corporate-fields";

const ON = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90";

export function ContactEditForm({ c, onSaved }: { c: Contact; onSaved?: () => void }) {
  const [state, formProps, pending] = useFormAction(updateContact);
  useEffect(() => {
    if (state?.ok) onSaved?.();
  }, [state, onSaved]);
  const [kind, setKind] = useState(c.kind === "kurumsal" ? "kurumsal" : "bireysel");
  const corp = kind === "kurumsal";
  const consentId = `mc-${c.id.slice(0, 6)}`;
  return (
    <form {...formProps} className="grid gap-3 text-sm">
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="kind" value={kind} />
      <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={kind} onValueChange={(v) => v && setKind(v)} aria-label="Tür">
        <ToggleGroupItem value="bireysel" className={ON}>
          Bireysel
        </ToggleGroupItem>
        <ToggleGroupItem value="kurumsal" className={ON}>
          Kurumsal
        </ToggleGroupItem>
      </ToggleGroup>
      {corp && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CorporateFields c={c} idPrefix={`ed-${c.id.slice(0, 6)}`} />
        </div>
      )}
      <Field label={corp ? "Yetkili ad soyad" : "Ad soyad"} name="fullName" defaultValue={corp ? (c.contactPerson ?? c.fullName) : c.fullName} required />
      {corp && <Field label="Yetkilinin görevi" name="contactTitle" defaultValue={c.contactTitle ?? ""} />}
      <Field label={corp ? "Yetkili telefonu" : "Telefon"} name="phone" defaultValue={formatPhone(c.phone)} required inputMode="tel" />
      <Field label="E-posta" name="email" type="email" defaultValue={c.email ?? ""} />
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notlar (profil)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={c.notes ?? ""}
          className="resize-y"
          placeholder={corp ? "Şirket, filo, lokasyonlar gibi kalıcı bilgiler" : "Aile, araç, ev gibi kalıcı bilgiler"}
        />
      </div>
      <Label htmlFor={consentId} className="cursor-pointer items-start text-xs font-normal text-muted-foreground">
        {/* Posts marketingConsent=on when checked, like the native checkbox did. */}
        <Checkbox id={consentId} name="marketingConsent" defaultChecked={c.marketingConsent} />
        Ticari ileti (kampanya) izni verdi
      </Label>
      <div className="flex items-center justify-end gap-3">
        {state?.error && (
          <span role="alert" className="text-xs text-brand">
            {state.error}
          </span>
        )}
        {state?.ok && <span className="text-xs text-emerald-700">Kaydedildi</span>}
        <Button type="submit" disabled={pending}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}
