/**
 * Normalises a Turkish phone number to 10 digits without the leading 0 or +90,
 * e.g. "+90 (532) 123 45 67" → "5321234567". Returns null when it isn't a valid TR number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^[2-5]\d{9}$/.test(d) ? d : null;
}

/** "5321234567" → "0532 123 45 67" */
export function formatPhone(p: string) {
  if (!/^\d{10}$/.test(p)) return p;
  return `0${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8)}`;
}

export function whatsappLink(p: string, text?: string) {
  return `https://wa.me/90${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
