"use client";

import { useState } from "react";
import type { Contact } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEE_COUNTS, SECTORS } from "@/lib/constants";

/** Radix Select items can't have an empty value; this stands for "not chosen" and posts "". */
const NONE = "__none";

/** Company details (unvan, yetkili, vergi, sektör…). The contact person's name uses the form's own "fullName" field. */
export function CorporateFields({ c, idPrefix = "co" }: { c?: Contact; idPrefix?: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const company = c && c.fullName !== c.contactPerson ? c.fullName : "";
  const [employees, setEmployees] = useState(c?.employeeCount ?? "");
  return (
    <>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={id("company")}>Şirket unvanı *</Label>
        <Input id={id("company")} name="companyName" defaultValue={company} placeholder="ör. Kaya Gıda San. ve Tic. Ltd. Şti." />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("taxno")}>Vergi no</Label>
        <Input id={id("taxno")} name="taxNo" inputMode="numeric" maxLength={11} defaultValue={c?.taxNo ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("taxoffice")}>Vergi dairesi</Label>
        <Input id={id("taxoffice")} name="taxOffice" defaultValue={c?.taxOffice ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("sector")}>Sektör</Label>
        <Input id={id("sector")} name="sector" list="sz-sectors" defaultValue={c?.sector ?? ""} autoComplete="off" />
        <datalist id="sz-sectors">
          {SECTORS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("emp")}>Çalışan sayısı</Label>
        <Select value={employees || NONE} onValueChange={(v) => setEmployees(v === NONE ? "" : v)}>
          <SelectTrigger id={id("emp")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={NONE}>—</SelectItem>
            {EMPLOYEE_COUNTS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="employeeCount" value={employees} />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={id("address")}>Adres</Label>
        <Input id={id("address")} name="address" defaultValue={c?.address ?? ""} />
      </div>
    </>
  );
}
