import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { PRODUCTS } from "./constants";

// Claude-powered helpers: reading policy documents and analysing a customer / lead profile.
// Enabled when ANTHROPIC_API_KEY is set. Everything sent here leaves Turkey (KVKK: yurt dışına aktarım),
// so the profile analysis never includes name, phone, e-mail, tax number or address.

const MODEL = "claude-opus-5-5";
// On a policy decline the API re-runs the request on a server-chosen fallback model (Claude Opus 5.5 default config).
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as const;

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function anthropic() {
  if (!aiEnabled()) throw new AiError("AI kapalı: ANTHROPIC_API_KEY tanımlı değil.");
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {}

const PRODUCT_CODES = PRODUCTS.map((p) => p.code) as [string, ...string[]];
const PRODUCT_GUIDE = PRODUCTS.filter((p) => p.code !== "genel")
  .map((p) => `${p.code} = ${p.label}`)
  .join(", ");

/** Runs one structured-output request and turns API problems into readable Turkish errors. */
async function ask<T>(params: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: z.ZodType<T> }): Promise<T> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(params.schema) },
      system: params.system,
      messages: [{ role: "user", content: params.content }],
      ...FALLBACK,
      betas: [...FALLBACK.betas],
    });
    if (res.stop_reason === "refusal") throw new AiError("AI bu isteği yanıtlamadı.");
    if (res.stop_reason === "max_tokens") throw new AiError("AI yanıtı yarıda kesildi, tekrar deneyin.");
    if (!res.parsed_output) throw new AiError("AI yanıtı okunamadı, tekrar deneyin.");
    return res.parsed_output as T;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("AI anahtarı geçersiz (ANTHROPIC_API_KEY).");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("AI şu an yoğun, biraz sonra tekrar deneyin.");
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`AI isteği reddedildi: ${e.message.slice(0, 200)}`);
    if (e instanceof Anthropic.APIError) throw new AiError(`AI hatası (${e.status ?? "?"}), tekrar deneyin.`);
    throw e;
  }
}

/* ------------------------------------------------------------ policy reading */

const ymd = z.string().describe("YYYY-MM-DD").nullable();

export const PolicyExtractionSchema = z.object({
  is_policy: z.boolean().describe("Belge bir sigorta poliçesi (veya poliçe teklifi/zeyilnamesi) mi?"),
  document_type: z.string().describe("ör. Poliçe, Teklif, Zeyilname, Ruhsat, Diğer"),
  product: z.enum(PRODUCT_CODES).describe("Ürün kodu"),
  insurer: z.string().nullable().describe("Sigorta şirketi adı, kısa haliyle (ör. Allianz, Anadolu Sigorta)"),
  policy_no: z.string().nullable(),
  insured_name: z.string().nullable().describe("Sigortalı / sigorta ettiren adı veya unvanı"),
  subject: z.string().nullable().describe("Sigortalanan: plaka ve araç, adres, kişiler, işyeri… kısa"),
  start_date: ymd,
  end_date: ymd.describe("Bitiş / yenileme tarihi, YYYY-MM-DD"),
  premium: z.number().nullable().describe("Toplam brüt prim (TL), sadece sayı"),
  coverage_summary: z.string().nullable().describe("Önemli teminatlar ve muafiyetler, en fazla 3 kısa cümle"),
  confidence: z.enum(["yüksek", "orta", "düşük"]).describe("Okunan bilgilerden ne kadar eminsin"),
  warnings: z.array(z.string()).describe("Okunamayan / şüpheli alanlar, kısa"),
});
export type PolicyExtraction = z.infer<typeof PolicyExtractionSchema>;

export async function readPolicyDocument(data: Buffer, mimeType: string): Promise<PolicyExtraction> {
  const b64 = data.toString("base64");
  const file: Anthropic.Beta.BetaContentBlockParam =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: b64 } };
  return ask({
    system:
      "Bir Türk sigorta acentesinde poliçe belgelerini okuyorsun. Belgedeki bilgileri olduğu gibi çıkar; " +
      "emin olmadığın alanı tahmin etme, null bırak ve warnings'e yaz. Tarihleri YYYY-MM-DD yaz. " +
      `Ürün kodları: ${PRODUCT_GUIDE}. Uymazsa "genel".`,
    content: [file, { type: "text", text: "Bu belgedeki poliçe bilgilerini çıkar." }],
    schema: PolicyExtractionSchema,
  });
}

/* ----------------------------------------------------------- profile analysis */

export const ProfileAnalysisSchema = z.object({
  summary: z.string().describe("Kişiyi/şirketi ve durumunu anlatan 2-3 cümle"),
  tags: z.array(z.string()).describe("Kısa profil etiketleri, ör. 'Araç sahibi', 'Ev sahibi', 'Aileli', 'Fiyat odaklı'; en fazla 6"),
  needs: z.array(z.string()).describe("Muhtemel sigorta ihtiyaçları ve riskler, kısa maddeler; en fazla 5"),
  cross_sell: z
    .array(
      z.object({
        product: z.enum(PRODUCT_CODES),
        reason: z.string().describe("Neden bu ürün, bu kişiye özel tek cümle"),
        priority: z.enum(["yüksek", "orta", "düşük"]),
      }),
    )
    .describe("Sahip olmadığı ve açık talebi olmayan ürünlerden önerilenler, önceliğe göre; en fazla 4"),
  next_action: z.object({
    title: z.string().describe("Yapılacak tek somut iş, ör. 'Konut teklifi için ara'"),
    when: z.enum(["bugün", "bu hafta", "bu ay", "yenileme öncesi"]),
    detail: z.string().describe("Nasıl yaklaşılmalı, 1-2 cümle"),
  }),
  churn_risk: z.object({
    level: z.enum(["düşük", "orta", "yüksek"]).describe("Müşteriyse kaybetme, lead ise vazgeçme riski"),
    reason: z.string(),
  }),
  suggested_message: z
    .string()
    .describe("Sıradaki adım için WhatsApp mesajı taslağı. Samimi ama profesyonel, en fazla 3 cümle. '{ad}' ile hitap et, '{temsilci}' ile imzala."),
});
export type ProfileAnalysis = z.infer<typeof ProfileAnalysisSchema>;

/** The profile as sent to the model: no direct identifiers. Built in actions.ts. */
export type AnonymousProfile = Record<string, unknown>;

export async function analyzeProfile(profile: AnonymousProfile): Promise<ProfileAnalysis> {
  return ask({
    system:
      "Sezar Sigorta adlı Türk sigorta acentesinin satış ekibine yardım ediyorsun. Sana bir lead'in ya da müşterinin " +
      "anonim profili verilecek: poliçeleri, talepleri, form cevapları ve ekibin notları. Ekibin bir sonraki adımı " +
      "için kısa, somut, Türkçe öneriler üret. Profilde olmayan bilgiyi uydurma; tahmin ettiğin şeyi 'muhtemelen' " +
      "diye belirt. Yasal zorunluluklara (Zorunlu Trafik, DASK) ve yaklaşan yenilemelere öncelik ver. " +
      `Ürün kodları: ${PRODUCT_GUIDE}.`,
    content: [{ type: "text", text: `Profil (JSON):\n${JSON.stringify(profile, null, 1)}` }],
    schema: ProfileAnalysisSchema,
  });
}
