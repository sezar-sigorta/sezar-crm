"use client";

import { useState } from "react";
import type { Policy } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INSURERS, PRODUCTS } from "@/lib/constants";
import { addYearsYmd } from "@/lib/format";

/** Policy inputs shared by "Poliçe ekle / düzenle" and "Müşteriye dönüştür". */
export function PolicyFields({ p, defaultProduct, idPrefix = "pf" }: { p?: Partial<Policy>; defaultProduct?: string; idPrefix?: string }) {
  const [start, setStart] = useState(p?.startDate ?? "");
  const [end, setEnd] = useState(p?.endDate ?? "");
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor={id("product")}>Poliçe türü *</Label>
        <Select name="product" required defaultValue={p?.product ?? defaultProduct ?? undefined}>
          <SelectTrigger id={id("product")} className="w-full">
            <SelectValue placeholder="Seçin" />
          </SelectTrigger>
          <SelectContent position="popper">
            {PRODUCTS.filter((x) => x.code !== "genel").map((x) => (
              <SelectItem key={x.code} value={x.code}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("insurer")}>Sigorta şirketi</Label>
        <Input id={id("insurer")} name="insurer" list="sz-insurers" defaultValue={p?.insurer ?? ""} autoComplete="off" />
        <datalist id="sz-insurers">
          {INSURERS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("start")}>Başlangıç</Label>
        <Input
          id={id("start")}
          name="startDate"
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (e.target.value && !end) setEnd(addYearsYmd(e.target.value, 1));
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("end")}>Yenileme (bitiş) tarihi *</Label>
        <Input id={id("end")} name="endDate" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("no")}>Poliçe no</Label>
        <Input id={id("no")} name="policyNo" defaultValue={p?.policyNo ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("premium")}>Prim (₺)</Label>
        <Input id={id("premium")} name="premium" inputMode="decimal" defaultValue={p?.premium ? Number(p.premium).toLocaleString("tr-TR") : ""} />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={id("subject")}>Sigortalanan</Label>
        <Input id={id("subject")} name="subject" defaultValue={p?.subject ?? ""} placeholder="Plaka, adres, kişiler…" />
      </div>
    </div>
  );
}
