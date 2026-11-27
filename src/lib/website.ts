import labels from "./site-quiz-labels.json";
import { type ProductCode, guessProduct } from "./constants";
import type { IncomingLead } from "./ingest";

// Maps the payload sezarsigorta.com sends (see the site's build_theme.py → window.szSend)
// into an IncomingLead.
//   Quiz:       { type: 'teklif', a: { who, age, car, … }, c: { ad, tel, k, p, w }, seg, page, lang }
//   Call-back:  { type: 'arama', seg, ad, tel, konu, <other form fields>, page, lang }

const QUIZ = labels as Record<string, { q: string; o: Record<string, string> }>;
const QUIZ_WHEN = ["Hemen", "Öğleden sonra", "Akşam", "Yarın"];
const SKIP = new Set(["type", "a", "c", "seg", "page", "lang", "ad", "tel", "kvkk", "promo", "k", "p", "w", "konu"]);

const FIELD_LABELS: Record<string, string> = { not: "Not", note: "Not", mesaj: "Mesaj", email: "E-posta", eposta: "E-posta", gun: "Gün", saat: "Saat", slot: "Saat aralığı" };

type Payload = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : Array.isArray(v) ? v.map(String).join(", ") : String(v)).trim();
const yes = (v: unknown) => v === true || v === "on" || v === "1" || v === "true" || v === "evet";

// Product quote form ("Ürün teklif formu", type 'urun'):
//   { type: 'urun', form, pol, pk: [product ids], urun, mode, seg, c: { ad, tel, k, p },
//     email, dogum, sehir, adres, answers: { <question label>: value }, page, lang }
// Its product ids → CRM products. 'uzman' = "let an expert call me", no product chosen.
export const SITE_PRODUCTS: Record<string, ProductCode> = {
  trafik: "trafik", kasko: "kasko", imm: "imm", dask: "dask", konut: "konut",
  tss: "tamamlayici_saglik", ozs: "ozel_saglik", hayat: "hayat", ferdi: "ferdi_kaza", seyahat: "seyahat_saglik",
  evcil: "evcil_hayvan", isyeri: "isyeri", tpl: "ucuncu_sahis", ims: "isveren_mali", siber: "siber_risk",
  mesleki: "mesleki_sorumluluk", gsaglik: "grup_saglik", dno: "yonetici_sorumluluk", filo: "filo", nakliyat: "nakliyat",
};
const BUSINESS: ProductCode[] = ["isyeri", "ucuncu_sahis", "isveren_mali", "siber_risk", "mesleki_sorumluluk", "grup_saglik", "yonetici_sorumluluk", "filo", "nakliyat"];

/** One lead per product: the product form can ask for a package (e.g. Kasko + Trafik). */
export function websitePayloadToLeads(d: Payload): IncomingLead[] {
  if (d.type !== "urun") return [websitePayloadToLead(d)];
  const c = (d.c && typeof d.c === "object" ? d.c : {}) as Payload;
  const ids = (Array.isArray(d.pk) && d.pk.length ? d.pk : [d.pol]).map(String);
  const products = [...new Set(ids.map((id) => SITE_PRODUCTS[id] ?? guessProduct(id)))];
  if (!products.length) products.push("genel");

  const answers: Record<string, string> = {};
  if (str(d.urun) && products.length > 1) answers["Paket"] = str(d.urun);
  if (d.pol === "uzman") answers["Talep"] = "Uzman arasın (ürün seçilmedi)";
  const given = (d.answers && typeof d.answers === "object" ? d.answers : {}) as Payload;
  for (const [k, v] of Object.entries(given)) if (str(v)) answers[k.slice(0, 100)] = str(v).slice(0, 500);
  if (str(d.adres)) answers["Adres"] = [str(d.adres), str(d.sehir)].filter(Boolean).join(", ").slice(0, 500);
  if (d.lang && d.lang !== "tr") answers["Dil"] = str(d.lang);

  const birth = /^\d{4}-\d{2}-\d{2}$/.test(str(d.dogum)) ? str(d.dogum) : null;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(d.email)) ? str(d.email).slice(0, 200) : null;
  const business = d.seg === "biz" || products.some((p) => BUSINESS.includes(p));

  return products.map((product) => ({
    fullName: str(c.ad),
    phone: str(c.tel),
    email,
    city: str(d.sehir) || null,
    birthDate: birth,
    product,
    segment: business ? "kurumsal" : "bireysel",
    source: "website" as const,
    sourceDetail: { page: str(d.page) || "/", form: str(d.form) || "Ürün teklif formu" },
    answers,
    kvkkConsent: yes(c.k),
    marketingConsent: yes(c.p),
  }));
}

export function websitePayloadToLead(d: Payload): IncomingLead {
  const c = (d.c && typeof d.c === "object" ? d.c : d) as Payload;
  const quiz = (d.a && typeof d.a === "object" ? d.a : {}) as Payload;
  const isCall = d.type === "arama";
  const page = str(d.page);

  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(quiz)) {
    const def = QUIZ[k];
    const vals = (Array.isArray(v) ? v : [v]).map((x) => def?.o[String(x)] ?? String(x));
    answers[def?.q ?? k] = vals.length ? vals.join(", ") : "—";
  }
  if (d.konu) answers["Konu"] = str(d.konu);
  for (const [k, v] of Object.entries(d)) if (!SKIP.has(k) && str(v)) answers[FIELD_LABELS[k] ?? k] = str(v).slice(0, 500);
  if (d.lang && d.lang !== "tr") answers["Dil"] = str(d.lang);

  const segment = d.seg === "biz" || quiz.who === "biz" ? "kurumsal" : "bireysel";
  const product = productFromSite(page, str(d.konu), quiz, segment);

  let preferredCallTime: string | null = null;
  if (typeof c.w === "number" || /^\d$/.test(str(c.w))) preferredCallTime = QUIZ_WHEN[Number(c.w)] ?? null;
  else if (str(c.w)) preferredCallTime = str(c.w);

  return {
    fullName: str(c.ad),
    phone: str(c.tel),
    product,
    segment,
    source: "website",
    sourceDetail: { page: page || "/", form: isCall ? "Sizi arayalım" : "Teklif sihirbazı" },
    answers,
    kvkkConsent: yes(c.k ?? c.kvkk),
    marketingConsent: yes(c.p ?? c.promo),
    preferredCallTime,
  };
}

function productFromSite(page: string, konu: string, quiz: Payload, segment: string): ProductCode {
  const fromPage = guessProduct(page);
  if (fromPage !== "genel") return fromPage;
  const k = konu.toLocaleLowerCase("tr");
  if (k.includes("araç")) return "kasko";
  if (k.includes("konut")) return "konut";
  if (k.includes("sağlık")) return "tamamlayici_saglik";
  if (k.includes("işyeri")) return "isyeri";
  if (segment === "kurumsal") return "isyeri";
  if (quiz.health === "tss") return "tamamlayici_saglik";
  if (quiz.health === "ozs") return "ozel_saglik";
  if (quiz.car === "y") return "kasko";
  if (quiz.home === "own") return "konut";
  return "genel";
}
