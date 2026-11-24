"use client";

import { useState } from "react";
import type { Policy } from "@/db/schema";
import { INSURERS, PRODUCTS } from "@/lib/constants";
import { addYearsYmd } from "@/lib/format";

/** Policy inputs shared by "Poliçe ekle / düzenle" and "Müşteriye dönüştür". */
export function PolicyFields({ p, defaultProduct, idPrefix = "pf" }: { p?: Partial<Policy>; defaultProduct?: string; idPrefix?: string }) {
  const [start, setStart] = useState(p?.startDate ?? "");
  const [end, setEnd] = useState(p?.endDate ?? "");
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={id("product")}>
          Poliçe türü *
        </label>
        <select id={id("product")} name="product" required defaultValue={p?.product ?? defaultProduct ?? ""} className="input">
          <option value="" disabled>
            Seçin
          </option>
          {PRODUCTS.filter((x) => x.code !== "genel").map((x) => (
            <option key={x.code} value={x.code}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("insurer")}>
          Sigorta şirketi
        </label>
        <input id={id("insurer")} name="insurer" list="sz-insurers" defaultValue={p?.insurer ?? ""} className="input" autoComplete="off" />
        <datalist id="sz-insurers">
          {INSURERS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label" htmlFor={id("start")}>
          Başlangıç
        </label>
        <input
          id={id("start")}
          name="startDate"
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (e.target.value && !end) setEnd(addYearsYmd(e.target.value, 1));
          }}
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor={id("end")}>
          Yenileme (bitiş) tarihi *
        </label>
        <input id={id("end")} name="endDate" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("no")}>
          Poliçe no
        </label>
        <input id={id("no")} name="policyNo" defaultValue={p?.policyNo ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("premium")}>
          Prim (₺)
        </label>
        <input
          id={id("premium")}
          name="premium"
          inputMode="decimal"
          defaultValue={p?.premium ? Number(p.premium).toLocaleString("tr-TR") : ""}
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id("subject")}>
          Sigortalanan
        </label>
        <input id={id("subject")} name="subject" defaultValue={p?.subject ?? ""} placeholder="Plaka, adres, kişiler…" className="input" />
      </div>
    </div>
  );
}
