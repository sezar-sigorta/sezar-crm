"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { AiError, aiEnabled, analyzeProfile } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { productLabel, sourceLabel, stage } from "@/lib/constants";
import { daysUntil, todayYmd } from "@/lib/format";

const { contacts, requests, policies, activities } = schema;

/** Removes things that identify a person from free text before it leaves the CRM. */
function scrub(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-posta]")
    .replace(/(\+?90[\s-]?)?0?\(?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, "[telefon]")
    .replace(/\b\d{10,11}\b/g, "[numara]")
    .replace(/\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,2}\b/gi, "[IBAN]");
}

/** "AI analizi": builds an anonymous profile, asks Claude, stores the result on the contact. */
export async function analyzeContact(contactId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  if (!aiEnabled()) return { error: "AI kapalı: ANTHROPIC_API_KEY tanımlı değil." };
  const id = z.string().uuid().parse(contactId);
  const db = await getDb();
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!c) return { error: "Kişi bulunamadı." };
  const [reqs, pols, acts] = await Promise.all([
    db.select().from(requests).where(eq(requests.contactId, id)).orderBy(desc(requests.createdAt)),
    db.select().from(policies).where(eq(policies.contactId, id)),
    db
      .select()
      .from(activities)
      .where(eq(activities.contactId, id))
      .orderBy(desc(activities.createdAt))
      .limit(60),
  ]);
  const notes = acts.filter((a) => ["note", "call", "whatsapp"].includes(a.type)).slice(0, 30);
  const age = c.birthDate ? new Date().getFullYear() - Number(c.birthDate.slice(0, 4)) : null;

  // No name, phone, e-mail, tax number or address: only what helps a sales decision.
  const profile = {
    bugun: todayYmd(),
    tur: c.kind,
    durum: c.lifecycle === "customer" ? "müşteri" : "lead (henüz poliçe yok)",
    musteri_olma_tarihi: c.customerSince?.toISOString().slice(0, 10) ?? null,
    sehir: c.city,
    yas: age,
    meslek: c.occupation,
    sektor: c.sector,
    calisan_sayisi: c.employeeCount,
    yetkili_gorevi: c.contactTitle,
    arama_tercihi: c.preferredCallTime,
    ticari_ileti_izni: c.marketingConsent,
    ilk_kaynak: c.firstSource ? sourceLabel(c.firstSource) : null,
    profil_notu: c.notes ? scrub(c.notes) : null,
    policeler: pols.map((p) => ({
      urun: productLabel(p.product),
      urun_kodu: p.product,
      sirket: p.insurer,
      durum: p.status,
      baslangic: p.startDate,
      yenileme: p.endDate,
      yenilemeye_kalan_gun: p.status === "active" ? daysUntil(p.endDate) : null,
      prim_tl: p.premium ? Number(p.premium) : null,
      sigortalanan: p.subject ? scrub(p.subject) : null,
    })),
    talepler: reqs.map((r) => ({
      urun: productLabel(r.product),
      urun_kodu: r.product,
      asama: stage(r.stage).label,
      kaynak: sourceLabel(r.source),
      kampanya: r.sourceDetail?.campaign ?? null,
      tarih: r.createdAt.toISOString().slice(0, 10),
      kaybedilme_nedeni: r.lostReason,
      teklif_tl: r.quoteAmount ? Number(r.quoteAmount) : null,
      form_cevaplari: Object.fromEntries(Object.entries(r.answers ?? {}).map(([k, v]) => [k, scrub(String(v))])),
    })),
    notlar_ve_gorusmeler: notes.map((a) => ({ tarih: a.createdAt.toISOString().slice(0, 10), tur: a.type, metin: scrub(a.body ?? "") })),
  };

  try {
    const analysis = await analyzeProfile(profile);
    // Never suggest what they already have or already asked for.
    const owned = new Set([...pols.filter((p) => p.status === "active").map((p) => p.product), ...reqs.filter((r) => ["new", "followup"].includes(r.stage)).map((r) => r.product)]);
    analysis.cross_sell = analysis.cross_sell.filter((s) => !owned.has(s.product) && s.product !== "genel");
    await db.update(contacts).set({ aiAnalysis: analysis, aiAnalyzedAt: new Date() }).where(eq(contacts.id, id));
    revalidatePath(`/kisiler/${id}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    console.error("AI analysis failed", e);
    return { error: "Analiz yapılamadı, tekrar deneyin." };
  }
}

