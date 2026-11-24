// Shared vocabulary of the CRM: insurance products, pipeline stages, lead sources.

export const PRODUCTS = [
  { code: "kasko", label: "Kasko", slug: "kasko-sigortasi" },
  { code: "trafik", label: "Zorunlu Trafik", slug: "zorunlu-trafik-sigortasi" },
  { code: "imm", label: "İMM", slug: "imm-sigortasi" },
  { code: "ozel_saglik", label: "Özel Sağlık", slug: "ozel-saglik-sigortasi" },
  { code: "tamamlayici_saglik", label: "Tamamlayıcı Sağlık", slug: "tamamlayici-saglik-sigortasi" },
  { code: "seyahat_saglik", label: "Seyahat Sağlık", slug: "seyahat-saglik-sigortasi" },
  { code: "grup_saglik", label: "Grup Sağlık", slug: "grup-saglik-sigortasi" },
  { code: "hayat", label: "Hayat", slug: "hayat-sigortasi" },
  { code: "ferdi_kaza", label: "Ferdi Kaza", slug: "ferdi-kaza-sigortasi" },
  { code: "konut", label: "Konut", slug: "konut-sigortasi" },
  { code: "dask", label: "DASK", slug: "dask-zorunlu-deprem-sigortasi" },
  { code: "evcil_hayvan", label: "Evcil Hayvan", slug: "evcil-hayvan-sigortasi" },
  { code: "isyeri", label: "İşyeri", slug: "isyeri-sigortasi" },
  { code: "filo", label: "Filo", slug: "filo-sigortasi" },
  { code: "nakliyat", label: "Nakliyat", slug: "nakliyat-sigortasi" },
  { code: "isveren_mali", label: "İşveren Mali Sorumluluk", slug: "isveren-mali-sorumluluk-sigortasi" },
  { code: "ucuncu_sahis", label: "Üçüncü Şahıs Mali Sorumluluk", slug: "ucuncu-sahis-mali-sorumluluk-sigortasi" },
  { code: "mesleki_sorumluluk", label: "Mesleki Sorumluluk", slug: "mesleki-sorumluluk-sigortasi" },
  { code: "yonetici_sorumluluk", label: "Yönetici Sorumluluk", slug: "yonetici-sorumluluk-sigortasi" },
  { code: "siber_risk", label: "Siber Risk", slug: "siber-risk-sigortasi" },
  { code: "genel", label: "Belirtilmedi", slug: "" },
] as const;

export type ProductCode = (typeof PRODUCTS)[number]["code"];

export function productLabel(code: string | null | undefined) {
  return PRODUCTS.find((p) => p.code === code)?.label ?? code ?? "Belirtilmedi";
}

/** Best-effort guess of the product from a URL path or free text (site page, Meta form name…). */
export function guessProduct(...hints: (string | null | undefined)[]): ProductCode {
  const text = hints
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
  if (!text) return "genel";
  for (const p of PRODUCTS) if (p.slug && text.includes(p.slug)) return p.code;
  const words: [RegExp, ProductCode][] = [
    [/kasko/, "kasko"],
    [/trafik/, "trafik"],
    [/tamamlayici|\btss\b/, "tamamlayici_saglik"],
    [/ozel saglik|\boss\b/, "ozel_saglik"],
    [/zmss|\bzorunlu mali\b/, "trafik"],
    [/seyahat/, "seyahat_saglik"],
    [/grup/, "grup_saglik"],
    [/saglik/, "ozel_saglik"],
    [/dask|deprem/, "dask"],
    [/konut|ev sigorta/, "konut"],
    [/evcil|kedi|kopek|pet/, "evcil_hayvan"],
    [/hayat/, "hayat"],
    [/ferdi|kaza/, "ferdi_kaza"],
    [/isyeri|dukkan/, "isyeri"],
    [/filo/, "filo"],
    [/nakliyat/, "nakliyat"],
    [/siber/, "siber_risk"],
    [/imm/, "imm"],
  ];
  for (const [re, code] of words) if (re.test(text)) return code;
  return "genel";
}

export const STAGES = [
  { code: "new", label: "Yeni", column: "Yeni", tone: "bg-orange-100 text-orange-800 border-orange-200" },
  {
    code: "followup",
    label: "Arandı – Takipte",
    column: "Arandı – Yumuşak red / Nötr / Dönüş bekliyoruz",
    tone: "bg-sky-100 text-sky-800 border-sky-200",
  },
  { code: "won", label: "Arandı – Kazanıldı", column: "Arandı – Kazanıldı", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { code: "lost", label: "Arandı – Kaybedildi", column: "Arandı – Kaybedildi", tone: "bg-stone-200 text-stone-700 border-stone-300" },
] as const;

export type StageCode = (typeof STAGES)[number]["code"];
export const OPEN_STAGES: StageCode[] = ["new", "followup"];

/** Sub-status of a request in the "Arandı" (followup) column. */
export const CALL_STATUSES = [
  { code: "soft_no", label: "Yumuşak red", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  { code: "neutral", label: "Nötr", tone: "bg-stone-50 text-stone-700 border-stone-200" },
  { code: "awaiting", label: "Dönüş bekliyoruz", tone: "bg-amber-50 text-amber-800 border-amber-200" },
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number]["code"];

/** One flat list for stage menus: Yeni, Arandı – Yumuşak red / Nötr / Dönüş bekliyoruz, Kazanıldı, Kaybedildi. */
export const PIPELINE_OPTIONS = [
  { value: "new", label: "Yeni" },
  ...CALL_STATUSES.map((c) => ({ value: `followup:${c.code}`, label: `Arandı – ${c.label}` })),
  { value: "won", label: "Arandı – Kazanıldı" },
  { value: "lost", label: "Arandı – Kaybedildi" },
];

export function pipelineValue(stage: string, status: string | null | undefined) {
  return stage === "followup" ? `followup:${status ?? "neutral"}` : stage;
}

export function callStatus(code: string | null | undefined) {
  return CALL_STATUSES.find((c) => c.code === code) ?? null;
}

export function stage(code: string) {
  return STAGES.find((s) => s.code === code) ?? STAGES[0];
}

export const LOST_REASONS = [
  "Fiyat yüksek bulundu",
  "Başka acenteden yaptırdı",
  "Ulaşılamadı",
  "Vazgeçti / ihtiyacı yok",
  "Uygun teklif çıkmadı",
  "Yanlış / sahte başvuru",
  "Diğer",
];

export const SOURCES = [
  { code: "website", label: "Web sitesi" },
  { code: "meta", label: "Meta reklamı" },
  { code: "instagram", label: "Instagram (DM)" },
  { code: "whatsapp", label: "WhatsApp" },
  { code: "phone", label: "Telefon" },
  { code: "referral", label: "Tavsiye" },
  { code: "walk_in", label: "Yüz yüze" },
  { code: "existing_customer", label: "Mevcut müşteri" },
  { code: "other", label: "Diğer" },
] as const;

export type SourceCode = (typeof SOURCES)[number]["code"];

/** Website form codes saved by early versions → readable names. */
export function formLabel(form: string | null | undefined) {
  if (form === "arama") return "Sizi arayalım";
  if (form === "teklif") return "Teklif sihirbazı";
  return form ?? null;
}

export function sourceLabel(code: string) {
  return SOURCES.find((s) => s.code === code)?.label ?? code;
}

/** Minutes within which a new lead should get a first response. */
export const FIRST_RESPONSE_SLA_MIN = 15;

export const WHATSAPP_TEMPLATES = [
  {
    id: "first",
    label: "İlk dönüş",
    text: "Merhaba {ad}, ben Sezar Sigorta'dan {temsilci}. {urun} sigortası için talebinizi aldık. Size en uygun teklifi hazırlamak için birkaç bilgiye ihtiyacım var, uygun olduğunuz bir saatte arayabilir miyim?",
  },
  {
    id: "unreachable",
    label: "Ulaşamadık",
    text: "Merhaba {ad}, Sezar Sigorta'dan {temsilci}. {urun} sigortası talebiniz için sizi aradık ama ulaşamadık. Size uygun bir saati yazarsanız tekrar arayalım.",
  },
  {
    id: "docs",
    label: "Bilgi / belge iste",
    text: "Merhaba {ad}, {urun} teklifinizi hazırlayabilmemiz için gereken bilgileri buraya yazabilir ya da fotoğrafını gönderebilirsiniz. Teşekkürler!",
  },
  {
    id: "quote",
    label: "Teklif hazır",
    text: "Merhaba {ad}, {urun} sigortası teklifiniz hazır. Detayları konuşmak için ne zaman müsaitsiniz?",
  },
] as const;

/** WhatsApp messages for existing customers. */
export const CUSTOMER_WHATSAPP_TEMPLATES = [
  {
    id: "renewal",
    label: "Yenileme hatırlatma",
    text: "Merhaba {ad}, Sezar Sigorta'dan {temsilci}. {urun} poliçenizin yenileme tarihi yaklaşıyor ({tarih}). Yenileme teklifinizi hazırlayalım mı? Bilgilerinizde değişiklik varsa buraya yazabilirsiniz.",
  },
  {
    id: "checkin",
    label: "Hal hatır / memnuniyet",
    text: "Merhaba {ad}, Sezar Sigorta'dan {temsilci}. Poliçelerinizle ilgili her şey yolunda mı? Herhangi bir sorunuz ya da hasar durumunuz olursa buradan yazabilirsiniz.",
  },
  {
    id: "crosssell",
    label: "Ek teklif",
    text: "Merhaba {ad}, Sezar Sigorta'dan {temsilci}. Mevcut müşterilerimize özel olarak {urun} sigortası için de teklif hazırlayabiliriz. İlgilenirseniz birkaç bilgiyle hemen hazırlayalım.",
  },
] as const;

/** Products worth offering to most individual customers (cross-sell suggestions). */
export const CROSS_SELL: ProductCode[] = ["kasko", "trafik", "konut", "dask", "tamamlayici_saglik", "ozel_saglik", "seyahat_saglik", "evcil_hayvan"];

/** "Durum" of a note: a plain note, or the result of a call. */
export const NOTE_STATUSES = [
  { code: "note", label: "Sadece not (görüşme yok)", short: "" },
  { code: "reached", label: "Görüşüldü", short: "Görüşüldü" },
  { code: "no_answer", label: "Görüşülemedi – açmadı", short: "Görüşülemedi (açmadı)" },
  { code: "busy", label: "Görüşülemedi – meşgul / sonra ara", short: "Görüşülemedi (meşgul / sonra ara)" },
  { code: "wrong_number", label: "Yanlış numara", short: "Yanlış numara" },
] as const;

/** Topics a note can be about besides a specific policy or request. */
export const NOTE_TOPICS = ["Teklif", "Yenileme", "Hasar", "Ödeme / taksit", "Belge / evrak", "Bilgi / soru", "Şikayet", "İptal", "Diğer"];

/** Why a product is worth offering (shown next to static cross-sell suggestions). */
export const CROSS_SELL_REASONS: Partial<Record<ProductCode, string>> = {
  kasko: "Aracı varsa: hasar, hırsızlık ve doğal afete karşı",
  trafik: "Araç sahipleri için yasal zorunluluk",
  konut: "Ev ve eşyalar için yangın, su baskını, hırsızlık",
  dask: "Ev sahipleri için yasal zorunluluk, deprem teminatı",
  tamamlayici_saglik: "SGK'lı ise özel hastanede fark ödemeden",
  ozel_saglik: "Kapsamlı özel hastane teminatı",
  seyahat_saglik: "Yurt dışına çıkanlar ve vize başvurusu için",
  evcil_hayvan: "Kedi / köpek veteriner masrafları",
  isyeri: "Dükkân, ofis ve depo için yangın, hırsızlık, cam kırılması",
  grup_saglik: "Çalışanlar için sağlık yan hakkı",
  isveren_mali: "İş kazalarında işverene gelecek talepler",
  filo: "Şirket araçları tek poliçede",
  nakliyat: "Taşınan mallar için",
  ucuncu_sahis: "Üçüncü kişilere verilen zararlar",
  mesleki_sorumluluk: "Mesleki hata ve ihmal talepleri",
  yonetici_sorumluluk: "Yöneticilere açılan davalar",
  siber_risk: "Müşteri verisi tutan işletmeler için veri ihlali",
};

/** Cross-sell suggestions for corporate customers. */
export const CROSS_SELL_CORPORATE: ProductCode[] = [
  "isyeri", "grup_saglik", "isveren_mali", "filo", "nakliyat", "ucuncu_sahis", "mesleki_sorumluluk", "yonetici_sorumluluk", "siber_risk",
];

export const EMPLOYEE_COUNTS = ["1–9", "10–49", "50–249", "250+"];

export const SECTORS = [
  "Perakende / mağaza", "Restoran / kafe", "Ofis / danışmanlık", "Sağlık / klinik", "Üretim / atölye", "İnşaat",
  "Lojistik / nakliye", "Turizm / otel", "Eğitim", "Teknoloji / yazılım", "E-ticaret", "Diğer",
];

export const INSURERS = [
  "Ak Sigorta", "Allianz", "Anadolu Sigorta", "Ankara Sigorta", "Axa", "Bupa Acıbadem", "Corpus", "Doğa Sigorta",
  "Eureko", "Groupama", "HDI", "Hepiyi", "Magdeburger", "Mapfre", "Neova", "Quick Sigorta", "Ray Sigorta",
  "Sompo", "Türk Nippon", "Türkiye Sigorta", "Unico", "Zurich",
];

/** Automatic renewal alarms: days before the renewal date. */
export const RENEWAL_ALARM_DAYS = [30, 7];
