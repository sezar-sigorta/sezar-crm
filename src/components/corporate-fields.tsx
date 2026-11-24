import type { Contact } from "@/db/schema";
import { EMPLOYEE_COUNTS, SECTORS } from "@/lib/constants";

/** Company details (unvan, yetkili, vergi, sektör…). The contact person's name uses the form's own "fullName" field. */
export function CorporateFields({ c, idPrefix = "co" }: { c?: Contact; idPrefix?: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const company = c && c.fullName !== c.contactPerson ? c.fullName : "";
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id("company")}>
          Şirket unvanı *
        </label>
        <input id={id("company")} name="companyName" defaultValue={company} placeholder="ör. Kaya Gıda San. ve Tic. Ltd. Şti." className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("taxno")}>
          Vergi no
        </label>
        <input id={id("taxno")} name="taxNo" inputMode="numeric" maxLength={11} defaultValue={c?.taxNo ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("taxoffice")}>
          Vergi dairesi
        </label>
        <input id={id("taxoffice")} name="taxOffice" defaultValue={c?.taxOffice ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("sector")}>
          Sektör
        </label>
        <input id={id("sector")} name="sector" list="sz-sectors" defaultValue={c?.sector ?? ""} className="input" autoComplete="off" />
        <datalist id="sz-sectors">
          {SECTORS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label" htmlFor={id("emp")}>
          Çalışan sayısı
        </label>
        <select id={id("emp")} name="employeeCount" defaultValue={c?.employeeCount ?? ""} className="input">
          <option value="">—</option>
          {EMPLOYEE_COUNTS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id("address")}>
          Adres
        </label>
        <input id={id("address")} name="address" defaultValue={c?.address ?? ""} className="input" />
      </div>
    </>
  );
}
