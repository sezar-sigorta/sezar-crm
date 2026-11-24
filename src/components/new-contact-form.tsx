"use client";

import { useState } from "react";
import { createCustomer, createManualLead } from "@/app/(app)/actions";
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
      <fieldset className="sm:col-span-2">
        <legend className="label">Tür</legend>
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="radiogroup">
          {(["bireysel", "kurumsal"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-md px-4 py-1.5 text-sm ${kind === k ? "bg-navy text-cream" : "text-ink-2 hover:text-navy"}`}
            >
              {k === "bireysel" ? "Bireysel" : "Kurumsal"}
            </button>
          ))}
        </div>
      </fieldset>

      {corp && <CorporateFields />}

      <div className={corp ? "" : "sm:col-span-2"}>
        <label className="label" htmlFor="fullName">
          {corp ? "Yetkili ad soyad *" : "Ad soyad *"}
        </label>
        <input id="fullName" name="fullName" required className="input" autoFocus={!corp} />
      </div>
      {corp && (
        <div>
          <label className="label" htmlFor="contactTitle">
            Yetkilinin görevi
          </label>
          <input id="contactTitle" name="contactTitle" placeholder="ör. Genel Müdür, Muhasebe" className="input" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="phone">
          {corp ? "Yetkili telefonu *" : "Cep telefonu *"}
        </label>
        <input id="phone" name="phone" required inputMode="tel" placeholder="05XX XXX XX XX" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          E-posta
        </label>
        <input id="email" name="email" type="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="city">
          Şehir
        </label>
        <input id="city" name="city" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="source">
          Nereden geldi?
        </label>
        <select id="source" name="source" defaultValue={mode === "customer" ? "referral" : "phone"} className="input">
          {SOURCES.filter((s) => s.code !== "website" && s.code !== "meta").map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {mode === "lead" ? (
        <div>
          <label className="label" htmlFor="product">
            İlgilendiği sigorta *
          </label>
          <select id="product" name="product" required defaultValue="" className="input">
            <option value="" disabled>
              Seçin
            </option>
            {PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="customerSince">
              Müşteri olma tarihi
            </label>
            <input id="customerSince" name="customerSince" type="date" defaultValue={todayYmd()} className="input" />
          </div>
          <fieldset className="space-y-3 rounded-lg border border-line p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="addPolicy" checked={withPolicy} onChange={(e) => setWithPolicy(e.target.checked)} className="accent-navy" />
                Poliçesini ekle
              </label>
            </legend>
            {withPolicy ? (
              <PolicyFields idPrefix="nc" defaultProduct={corp ? "isyeri" : undefined} />
            ) : (
              <p className="text-xs text-ink-2">Poliçeleri daha sonra profilden ekleyebilirsiniz.</p>
            )}
          </fieldset>
        </>
      )}

      <div className="sm:col-span-2">
        <label className="label" htmlFor="note">
          Not
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="input resize-y"
          placeholder={mode === "customer" ? "Müşteri hakkında bilinmesi gerekenler…" : "Ne istedi, ne zaman aranmak istiyor…"}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="kvkk" className="mt-1 accent-navy" />
          <span>
            {corp ? "Yetkiliye" : "Kişiye"} KVKK aydınlatma metni iletildi ve iletişime geçilmesini kabul etti. *
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="marketing" className="mt-1 accent-navy" />
          <span>Kampanya / ticari ileti almayı da kabul etti.</span>
        </label>
      </div>
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {state?.error && (
          <span role="alert" className="text-sm text-accent">
            {state.error}
          </span>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : mode === "customer" ? "Müşteriyi kaydet" : "Lead'i kaydet"}
        </button>
      </div>
    </form>
  );
}
