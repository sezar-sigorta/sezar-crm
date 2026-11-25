"use client";

import { useState } from "react";
import { createCustomer, createManualLead } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PRODUCTS, SOURCES } from "@/lib/constants";
import { todayYmd } from "@/lib/format";
import { CorporateFields } from "./corporate-fields";
import { PolicyFields } from "./policy-fields";
import { useFormAction } from "./use-form-action";

export function NewContactForm({ mode }: { mode: "lead" | "customer" }) {
  const [state, formProps, pending] = useFormAction(mode === "customer" ? createCustomer : createManualLead);
  const [kind, setKind] = useState<"bireysel" | "kurumsal">("bireysel");
  const [withPolicy, setWithPolicy] = useState(true);
  const corp = kind === "kurumsal";

  return (
    <form {...formProps} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Tür</legend>
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as "bireysel" | "kurumsal")}
          className="bg-card"
          aria-label="Tür"
        >
          <ToggleGroupItem value="bireysel" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Bireysel
          </ToggleGroupItem>
          <ToggleGroupItem value="kurumsal" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Kurumsal
          </ToggleGroupItem>
        </ToggleGroup>
      </fieldset>

      {corp && <CorporateFields />}

      <Field id="fullName" label={corp ? "Yetkili ad soyad *" : "Ad soyad *"} className={corp ? "" : "sm:col-span-2"}>
        <Input id="fullName" name="fullName" required autoFocus={!corp} />
      </Field>
      {corp && (
        <Field id="contactTitle" label="Yetkilinin görevi">
          <Input id="contactTitle" name="contactTitle" placeholder="ör. Genel Müdür, Muhasebe" />
        </Field>
      )}
      <Field id="phone" label={corp ? "Yetkili telefonu *" : "Cep telefonu *"}>
        <Input id="phone" name="phone" required inputMode="tel" placeholder="05XX XXX XX XX" />
      </Field>
      <Field id="email" label="E-posta">
        <Input id="email" name="email" type="email" />
      </Field>
      <Field id="city" label="Şehir">
        <Input id="city" name="city" />
      </Field>
      <Field id="source" label="Nereden geldi?">
        <Select name="source" defaultValue={mode === "customer" ? "referral" : "phone"}>
          <SelectTrigger id="source" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.filter((s) => s.code !== "website" && s.code !== "meta").map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {mode === "lead" ? (
        <Field id="product" label="İlgilendiği sigorta *">
          <Select name="product" required>
            <SelectTrigger id="product" className="w-full">
              <SelectValue placeholder="Seçin" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTS.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <>
          <Field id="customerSince" label="Müşteri olma tarihi">
            <Input id="customerSince" name="customerSince" type="date" defaultValue={todayYmd()} />
          </Field>
          <fieldset className="space-y-3 rounded-lg border p-4 sm:col-span-2">
            <legend className="px-1">
              <Label className="text-sm">
                <Checkbox name="addPolicy" checked={withPolicy} onCheckedChange={(c) => setWithPolicy(c === true)} />
                Poliçesini ekle
              </Label>
            </legend>
            {withPolicy ? (
              <PolicyFields idPrefix="nc" defaultProduct={corp ? "isyeri" : undefined} />
            ) : (
              <p className="text-xs text-muted-foreground">Poliçeleri daha sonra profilden ekleyebilirsiniz.</p>
            )}
          </fieldset>
        </>
      )}

      <Field id="note" label="Not" className="sm:col-span-2">
        <Textarea
          id="note"
          name="note"
          rows={3}
          className="resize-y"
          placeholder={mode === "customer" ? "Müşteri hakkında bilinmesi gerekenler…" : "Ne istedi, ne zaman aranmak istiyor…"}
        />
      </Field>
      <div className="space-y-3 sm:col-span-2">
        <Label className="items-start font-normal">
          <Checkbox name="kvkk" className="mt-0.5" />
          <span>{corp ? "Yetkiliye" : "Kişiye"} KVKK aydınlatma metni iletildi ve iletişime geçilmesini kabul etti. *</span>
        </Label>
        <Label className="items-start font-normal">
          <Checkbox name="marketing" className="mt-0.5" />
          <span>Kampanya / ticari ileti almayı da kabul etti.</span>
        </Label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
        {state?.error && (
          <span role="alert" className="text-sm text-brand">
            {state.error}
          </span>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Kaydediliyor…" : mode === "customer" ? "Müşteriyi kaydet" : "Lead'i kaydet"}
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
