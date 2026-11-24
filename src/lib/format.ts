const TZ = "Europe/Istanbul";

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(
    new Date(d),
  );
}

/** "3 dk önce", "2 sa önce", "dün", "5 gün önce" — or "2 sa sonra" for future dates. */
export function ago(d: Date | string | null | undefined, now = new Date()) {
  if (!d) return "—";
  const diff = now.getTime() - new Date(d).getTime();
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60000);
  let s: string;
  if (m < 1) return "şimdi";
  if (m < 60) s = `${m} dk`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)} sa`;
  else if (m < 60 * 24 * 2 && !future) return "dün";
  else s = `${Math.round(m / 1440)} gün`;
  return future ? `${s} sonra` : `${s} önce`;
}

export function minutesSince(d: Date | string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(d).getTime()) / 60000);
}

/** Value for <input type="datetime-local"> in Istanbul time. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
  return parts.replace(" ", "T");
}

/** Parses <input type="datetime-local"> (Istanbul time, UTC+3, no DST) into a Date. */
export function fromLocalInput(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(`${v}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today's date in Istanbul as YYYY-MM-DD. */
export function todayYmd(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);
}

/** Days from today (Istanbul) until a YYYY-MM-DD date; negative when past. */
export function daysUntil(ymd: string | null | undefined, now = new Date()) {
  if (!ymd) return null;
  const a = Date.parse(`${todayYmd(now)}T00:00:00Z`);
  const b = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isNaN(b) ? null : Math.round((b - a) / 864e5);
}

/** "2026-12-15" → "15 Aralık 2026" */
export function fmtYmd(ymd: string | null | undefined) {
  if (!ymd) return "—";
  return fmtDate(new Date(`${ymd}T12:00:00+03:00`));
}

/** "1 yıl 3 ay", "5 ay", "12 gün" since a date. */
export function durationSince(d: Date | string | null | undefined, now = new Date()) {
  if (!d) return "—";
  const days = Math.floor((now.getTime() - new Date(d).getTime()) / 864e5);
  if (days < 31) return `${Math.max(days, 0)} gün`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ay`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yıl ${m} ay` : `${y} yıl`;
}

/** Adds years to a YYYY-MM-DD date (29 Feb → 28 Feb). */
export function addYearsYmd(ymd: string, years: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr"))
    .join("");
}
