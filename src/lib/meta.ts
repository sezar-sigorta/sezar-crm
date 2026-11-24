import { guessProduct } from "./constants";
import type { IncomingLead } from "./ingest";

// Meta (Facebook / Instagram) Lead Ads.
// The webhook only tells us a lead id; the lead itself is fetched from the Graph API
// with a Page access token that has the leads_retrieval permission.

export type MetaLead = {
  id: string;
  created_time?: string;
  field_data?: { name: string; values?: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string; // fb | ig
  is_organic?: boolean;
};

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`;

async function graph<T>(path: string, fields: string): Promise<T> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not set");
  const url = `${GRAPH()}/${path}?fields=${fields}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  return json as T;
}

export async function fetchMetaLead(leadgenId: string) {
  const lead = await graph<MetaLead>(
    leadgenId,
    "created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic",
  );
  let formName = "";
  if (lead.form_id) {
    try {
      formName = (await graph<{ name?: string }>(lead.form_id, "name")).name ?? "";
    } catch {
      /* form name is nice to have */
    }
  }
  return { lead, formName };
}

// Standard Meta field keys → our fields. Everything else is kept as a form answer.
const NAME_KEYS = ["full_name", "ad_soyad", "ad_ve_soyad", "isim"];
const FIRST = ["first_name"];
const LAST = ["last_name"];
const PHONE_KEYS = ["phone_number", "phone", "telefon", "telefon_numarası", "cep_telefonu"];
const EMAIL_KEYS = ["email", "e-posta", "eposta"];
const CITY_KEYS = ["city", "şehir", "sehir", "il"];
const COMPANY_KEYS = ["company_name", "şirket_adı", "sirket_adi", "firma_adı", "firma"];
const JOB_KEYS = ["job_title", "unvan", "pozisyon"];
const PRODUCT_KEYS = ["sigorta_türü", "sigorta_turu", "hangi_sigorta", "urun", "ürün", "poliçe_türü"];

function pretty(key: string) {
  const s = key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
}

export function metaLeadToIncoming(lead: MetaLead, formName = ""): IncomingLead {
  const fields = new Map<string, string>();
  for (const f of lead.field_data ?? []) fields.set(f.name.toLocaleLowerCase("tr"), (f.values ?? []).join(", ").trim());
  const take = (keys: string[]) => {
    for (const k of keys) {
      const v = fields.get(k);
      if (v) {
        fields.delete(k);
        return v;
      }
    }
    return "";
  };

  let fullName = take(NAME_KEYS);
  const first = take(FIRST);
  const last = take(LAST);
  if (!fullName) fullName = [first, last].filter(Boolean).join(" ");
  const phone = take(PHONE_KEYS);
  const email = take(EMAIL_KEYS);
  const city = take(CITY_KEYS);
  const productAnswer = take(PRODUCT_KEYS);
  const companyName = take(COMPANY_KEYS);
  const jobTitle = take(JOB_KEYS);

  const answers: Record<string, string> = {};
  if (formName) answers["Form"] = formName;
  if (productAnswer) answers["Sigorta türü"] = productAnswer;
  for (const [k, v] of fields) if (v) answers[pretty(k)] = v.slice(0, 500);

  const product = guessProduct(productAnswer, formName, lead.campaign_name, lead.adset_name, lead.ad_name);
  const sourceDetail: Record<string, string> = {};
  const put = (k: string, v?: string) => v && (sourceDetail[k] = v);
  put("platform", lead.platform === "ig" ? "Instagram" : lead.platform === "fb" ? "Facebook" : lead.platform);
  put("campaign", lead.campaign_name);
  put("adset", lead.adset_name);
  put("ad", lead.ad_name);
  put("form", formName);
  put("campaign_id", lead.campaign_id);
  put("ad_id", lead.ad_id);
  put("form_id", lead.form_id);
  if (lead.is_organic) sourceDetail.organic = "evet";

  return {
    fullName,
    phone,
    email: email || null,
    city: city || null,
    product,
    segment: companyName || /kurumsal|işyeri|isyeri|filo|şirket/i.test(`${formName} ${lead.campaign_name ?? ""}`) ? "kurumsal" : "bireysel",
    companyName: companyName || null,
    contactTitle: jobTitle || null,
    source: "meta",
    sourceDetail,
    answers,
    // Submitting a Meta lead form means accepting the privacy text shown on the form.
    kvkkConsent: true,
    marketingConsent: false,
    externalId: `meta:${lead.id}`,
    receivedAt: lead.created_time ? new Date(lead.created_time) : undefined,
  };
}
