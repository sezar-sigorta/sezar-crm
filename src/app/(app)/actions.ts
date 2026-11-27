"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import {
  CALL_STATUSES,
  CUSTOMER_WHATSAPP_TEMPLATES,
  NOTE_STATUSES,
  NOTE_TOPICS,
  type CallStatus,
  LOST_REASONS,
  OPEN_STAGES,
  PRODUCTS,
  SOURCES,
  STAGES,
  WHATSAPP_TEMPLATES,
  productLabel,
  stage as stageOf,
} from "@/lib/constants";
import { addYearsYmd, fmtYmd, fromLocalInput } from "@/lib/format";
import { ingestLead } from "@/lib/ingest";
import { fetchMetaLead, listRecentMetaLeads, metaLeadToIncoming } from "@/lib/meta";
import { normalizePhone } from "@/lib/phone";
import { insertPolicy, makeCustomer, syncRenewalAlarms } from "@/lib/policies";
import { websitePayloadToLeads } from "@/lib/website";

const { contacts, requests, activities, inbox, policies, reminders } = schema;
const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PRODUCT_CODES = PRODUCTS.map((p) => p.code) as [string, ...string[]];

function refresh(contactId?: string) {
  revalidatePath("/", "layout");
  if (contactId) revalidatePath(`/kisiler/${contactId}`);
}

async function loadRequest(id: string) {
  const db = await getDb();
  const [r] = await db.select().from(requests).where(eq(requests.id, uuid.parse(id)));
  if (!r) throw new Error("Talep bulunamadı");
  return r;
}

async function loadContact(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(contacts).where(eq(contacts.id, uuid.parse(id)));
  if (!c) throw new Error("Kişi bulunamadı");
  return c;
}

/* ------------------------------------------------------------------ pipeline */

/** Moves a request to another pipeline stage (kanban drag, stage menu). */
export async function moveStage(requestId: string, to: string, lostReason?: string, status?: CallStatus) {
  const user = await requireUser();
  if (!STAGES.some((s) => s.code === to)) throw new Error("Geçersiz aşama");
  if (to === "lost" && !LOST_REASONS.includes(lostReason ?? "")) return { error: "Kaybedilme nedeni seçin." };
  const r = await loadRequest(requestId);
  if (r.stage === to) return { ok: true };
  const db = await getDb();
  const now = new Date();
  const closed = to === "won" || to === "lost";
  await db.transaction(async (tx) => {
    await tx
      .update(requests)
      .set({
        stage: to,
        stageChangedAt: now,
        updatedAt: now,
        lostReason: to === "lost" ? lostReason : null,
        // Entering "Arandı" without a sub-status: Nötr until someone picks one.
        callStatus: to === "followup" ? (status ?? r.callStatus ?? "neutral") : r.callStatus,
        closedAt: closed ? now : null,
        firstContactedAt: r.firstContactedAt ?? (to !== "new" ? now : null),
        assignedTo: r.assignedTo ?? user.uid,
      })
      .where(eq(requests.id, r.id));
    if (to === "won") await makeCustomer(tx, r.contactId, user.uid, now, `${productLabel(r.product)} talebi kazanıldı`);
    await tx.insert(activities).values({
      contactId: r.contactId,
      requestId: r.id,
      userId: user.uid,
      type: "stage",
      body: `${productLabel(r.product)}: ${stageText(r.stage, r.callStatus)} → ${stageText(to, to === "followup" ? (status ?? r.callStatus ?? "neutral") : null)}${to === "lost" ? ` (${lostReason})` : ""}`,
      meta: { from: r.stage, to },
    });
  });
  refresh(r.contactId);
  return { ok: true };
}

/** "Arandı – Nötr" rather than the column name for requests in the "Arandı" column. */
function stageText(stage: string, status: string | null | undefined) {
  const cs = stage === "followup" ? CALL_STATUSES.find((c) => c.code === status) : null;
  return cs ? `Arandı – ${cs.label}` : stageOf(stage).label;
}

/** Yumuşak red / Nötr / Dönüş bekliyoruz for a request in the "Arandı" column. */
export async function setCallStatus(requestId: string, status: string) {
  const user = await requireUser();
  const cs = CALL_STATUSES.find((c) => c.code === status);
  if (!cs) throw new Error("Geçersiz durum");
  const r = await loadRequest(requestId);
  if (r.callStatus === cs.code && r.stage === "followup") return;
  if (r.stage !== "followup") return moveStage(r.id, "followup", undefined, cs.code);
  const db = await getDb();
  await db.update(requests).set({ callStatus: cs.code, updatedAt: new Date() }).where(eq(requests.id, r.id));
  await db.insert(activities).values({
    contactId: r.contactId,
    requestId: r.id,
    userId: user.uid,
    type: "stage",
    body: `${productLabel(r.product)}: ${cs.label}`,
  });
  refresh(r.contactId);
}

/* ------------------------------------------------------------- lead → customer */

const convertSchema = z.object({
  contactId: uuid,
  addPolicy: z.literal("on").optional(),
  product: z.enum(PRODUCT_CODES).optional(),
  insurer: z.string().trim().max(80).optional(),
  policyNo: z.string().trim().max(80).optional(),
  startDate: ymd.optional().or(z.literal("")),
  endDate: ymd.optional().or(z.literal("")),
  premium: z.string().max(30).optional(),
});

/** "Müşteriye dönüştür": optionally records the first policy and closes the matching request as won. */
export async function convertToCustomer(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = convertSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Bilgileri kontrol edin." };
  const d = p.data;
  if (d.addPolicy && !d.product) return { error: "Poliçe türünü seçin." };
  if (d.addPolicy && !d.endDate) return { error: "Yenileme (bitiş) tarihini girin." };
  const db = await getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await makeCustomer(tx, d.contactId, user.uid, now, "elle");
    if (d.addPolicy && d.product) {
      const [open] = await tx
        .select()
        .from(requests)
        .where(and(eq(requests.contactId, d.contactId), eq(requests.product, d.product), inArray(requests.stage, OPEN_STAGES)))
        .limit(1);
      await insertPolicy(tx, user.uid, {
        contactId: d.contactId,
        requestId: open?.id ?? null,
        product: d.product,
        insurer: d.insurer || null,
        policyNo: d.policyNo || null,
        startDate: d.startDate || null,
        endDate: d.endDate || null,
        premium: parseMoney(d.premium),
      });
      if (open) {
        await tx
          .update(requests)
          .set({ stage: "won", stageChangedAt: now, closedAt: now, updatedAt: now, firstContactedAt: open.firstContactedAt ?? now })
          .where(eq(requests.id, open.id));
        await tx.insert(activities).values({
          contactId: d.contactId,
          requestId: open.id,
          userId: user.uid,
          type: "stage",
          body: `${productLabel(open.product)}: ${stageOf(open.stage).label} → Kazanıldı`,
        });
      }
    }
  });
  refresh(d.contactId);
  // Redirect from the server: when converting from the Leadler list the row (and this dialog) disappears at once.
  redirect(`/kisiler/${d.contactId}`);
}

export async function revertToLead(contactId: string) {
  const user = await requireUser();
  const c = await loadContact(contactId);
  const db = await getDb();
  await db.update(contacts).set({ lifecycle: "lead", customerSince: null, updatedAt: new Date() }).where(eq(contacts.id, c.id));
  await db.insert(activities).values({ contactId: c.id, userId: user.uid, type: "system", body: "Lead'e geri alındı" });
  refresh(c.id);
}

/* ------------------------------------------------------------------- policies */

function parseMoney(v?: string | null) {
  if (!v) return null;
  const n = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  return n && !Number.isNaN(Number(n)) ? n : null;
}

const policySchema = z.object({
  id: uuid.optional().or(z.literal("")),
  documentId: uuid.optional().or(z.literal("")),
  contactId: uuid,
  product: z.enum(PRODUCT_CODES),
  insurer: z.string().trim().max(80).optional(),
  policyNo: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(200).optional(),
  startDate: ymd.optional().or(z.literal("")),
  endDate: ymd.optional().or(z.literal("")),
  premium: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export async function savePolicy(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = policySchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Poliçe türü ve tarihleri kontrol edin." };
  const d = p.data;
  if (d.startDate && d.endDate && d.endDate <= d.startDate) return { error: "Yenileme tarihi başlangıçtan sonra olmalı." };
  const db = await getDb();
  const values = {
    contactId: d.contactId,
    product: d.product,
    insurer: d.insurer || null,
    policyNo: d.policyNo || null,
    subject: d.subject || null,
    startDate: d.startDate || null,
    endDate: d.endDate || null,
    premium: parseMoney(d.premium),
    notes: d.notes?.trim() || null,
  };
  await db.transaction(async (tx) => {
    if (d.id) {
      const [before] = await tx.select().from(policies).where(and(eq(policies.id, d.id), eq(policies.contactId, d.contactId)));
      if (!before) throw new Error("Poliçe bulunamadı");
      await tx.update(policies).set({ ...values, updatedAt: new Date() }).where(eq(policies.id, d.id));
      if (before.endDate !== values.endDate || before.product !== values.product || before.insurer !== values.insurer) {
        await syncRenewalAlarms(tx, user.uid, d.id, d.contactId, values.product, values.insurer, before.status === "active" ? values.endDate : null);
      }
    } else {
      const policyId = await insertPolicy(tx, user.uid, values);
      await makeCustomer(tx, d.contactId, user.uid, new Date(), "poliçe eklendi");
      // Created from an uploaded document ("AI ile oku"): link the file to the new policy.
      if (d.documentId) {
        await tx
          .update(schema.documents)
          .set({ policyId })
          .where(and(eq(schema.documents.id, d.documentId), eq(schema.documents.contactId, d.contactId)));
      }
    }
  });
  refresh(d.contactId);
  return { ok: true, at: Date.now() };
}

export async function deletePolicy(policyId: string) {
  const user = await requireUser();
  const db = await getDb();
  const [p] = await db.select().from(policies).where(eq(policies.id, uuid.parse(policyId)));
  if (!p) return;
  await db.delete(policies).where(eq(policies.id, p.id)); // its alarms cascade
  await db.insert(activities).values({
    contactId: p.contactId,
    userId: user.uid,
    type: "system",
    body: `Poliçe silindi: ${productLabel(p.product)}${p.insurer ? ` · ${p.insurer}` : ""}`,
  });
  refresh(p.contactId);
}

/** "Yenilendi": closes this policy and opens next year's with the same details. */
export async function renewPolicy(policyId: string) {
  const user = await requireUser();
  const db = await getDb();
  const [p] = await db.select().from(policies).where(eq(policies.id, uuid.parse(policyId)));
  if (!p || p.status !== "active") return;
  const start = p.endDate ?? new Date().toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    await tx.update(policies).set({ status: "renewed", updatedAt: new Date() }).where(eq(policies.id, p.id));
    await syncRenewalAlarms(tx, user.uid, p.id, p.contactId, p.product, p.insurer, null);
    await insertPolicy(tx, user.uid, {
      contactId: p.contactId,
      product: p.product,
      insurer: p.insurer,
      policyNo: null,
      subject: p.subject,
      startDate: start,
      endDate: addYearsYmd(start, 1),
      premium: null,
      notes: null,
    });
  });
  refresh(p.contactId);
}

export async function cancelPolicy(policyId: string) {
  const user = await requireUser();
  const db = await getDb();
  const [p] = await db.select().from(policies).where(eq(policies.id, uuid.parse(policyId)));
  if (!p) return;
  await db.transaction(async (tx) => {
    await tx.update(policies).set({ status: "cancelled", updatedAt: new Date() }).where(eq(policies.id, p.id));
    await syncRenewalAlarms(tx, user.uid, p.id, p.contactId, p.product, p.insurer, null);
    await tx.insert(activities).values({
      contactId: p.contactId,
      userId: user.uid,
      type: "system",
      body: `Poliçe iptal edildi: ${productLabel(p.product)}`,
    });
  });
  refresh(p.contactId);
}

/* --------------------------------------------------------------------- alarms */

const reminderSchema = z.object({
  contactId: uuid,
  requestId: uuid.optional().or(z.literal("")),
  policyId: uuid.optional().or(z.literal("")),
  at: z.string().min(1),
  title: z.string().trim().min(1).max(300),
});

export async function addReminder(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = reminderSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Tarih ve açıklama girin." };
  const due = fromLocalInput(p.data.at);
  if (!due) return { error: "Geçerli bir tarih seçin." };
  const db = await getDb();
  await db.insert(reminders).values({
    contactId: p.data.contactId,
    requestId: p.data.requestId || null,
    policyId: p.data.policyId || null,
    dueAt: due,
    title: p.data.title,
    createdBy: user.uid,
  });
  await db.insert(activities).values({
    contactId: p.data.contactId,
    requestId: p.data.requestId || null,
    userId: user.uid,
    type: "followup",
    body: `Alarm kuruldu: ${new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" }).format(due)} — ${p.data.title}`,
  });
  refresh(p.data.contactId);
  return { ok: true, at: Date.now() };
}

export async function setReminderDone(id: string, done: boolean) {
  const user = await requireUser();
  const db = await getDb();
  const [r] = await db.select().from(reminders).where(eq(reminders.id, uuid.parse(id)));
  if (!r) return;
  await db.update(reminders).set({ doneAt: done ? new Date() : null }).where(eq(reminders.id, r.id));
  if (done) {
    await db.insert(activities).values({
      contactId: r.contactId,
      requestId: r.requestId,
      userId: user.uid,
      type: "followup",
      body: `Alarm tamamlandı: ${r.title}`,
    });
  }
  refresh(r.contactId);
}

export async function snoozeReminder(id: string, hours: number) {
  await requireUser();
  const db = await getDb();
  const [r] = await db.select().from(reminders).where(eq(reminders.id, uuid.parse(id)));
  if (!r) return;
  const base = Math.max(Date.now(), r.dueAt.getTime());
  await db.update(reminders).set({ dueAt: new Date(base + hours * 3600e3) }).where(eq(reminders.id, r.id));
  refresh(r.contactId);
}

export async function deleteReminder(id: string) {
  await requireUser();
  const db = await getDb();
  const [r] = await db.select().from(reminders).where(eq(reminders.id, uuid.parse(id)));
  if (!r) return;
  await db.delete(reminders).where(eq(reminders.id, r.id));
  refresh(r.contactId);
}

/* ------------------------------------------------------------- notes & calls */

const logSchema = z.object({
  contactId: uuid,
  status: z.enum(NOTE_STATUSES.map((s) => s.code) as [string, ...string[]]).default("note"),
  body: z.string().max(4000).optional(),
  product: z.enum(PRODUCT_CODES).optional().or(z.literal("")),
  topic: z.enum(NOTE_TOPICS as [string, ...string[]]).optional().or(z.literal("")),
});

/**
 * Notes and call logs (one form): "İlgili poliçe" (a product), "Sebep" and "Durum".
 * The note is linked to this person's open request(s) / active policies of that product.
 * A "Görüşüldü" call moves the related "Yeni" requests (or all of them when no product is picked) to "Arandı".
 */
export async function logActivity(_: unknown, form: FormData) {
  const user = await requireUser();
  const parsed = logSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Eksik bilgi." };
  const { contactId, status, body } = parsed.data;
  const product = parsed.data.product || null;
  const topics = parsed.data.topic ? [parsed.data.topic] : [];
  const text = body?.trim() ?? "";
  const isCall = status !== "note";
  if (!isCall && !text) return { error: "Not boş olamaz." };
  const db = await getDb();
  const now = new Date();

  const okReq = product
    ? (
        await db
          .select({ id: requests.id })
          .from(requests)
          .where(and(eq(requests.contactId, contactId), eq(requests.product, product), inArray(requests.stage, OPEN_STAGES)))
      ).map((r) => r.id)
    : [];
  const okPol = product
    ? (
        await db
          .select({ id: policies.id })
          .from(policies)
          .where(and(eq(policies.contactId, contactId), eq(policies.product, product), eq(policies.status, "active")))
      ).map((r) => r.id)
    : [];
  const cleanLinks = [...okReq.map((id) => ({ t: "request", id })), ...okPol.map((id) => ({ t: "policy", id }))];

  const statusLabel = NOTE_STATUSES.find((s) => s.code === status)?.short ?? "";
  await db.insert(activities).values({
    contactId,
    requestId: okReq[0] ?? null,
    userId: user.uid,
    type: isCall ? "call" : "note",
    body: isCall ? [statusLabel, text].filter(Boolean).join(" — ") : text,
    meta: { product, links: cleanLinks, topics, ...(isCall ? { outcome: status, text: text || undefined } : {}) },
  });

  if (isCall) {
    // A product was picked: only its requests. None picked: all of the person's requests.
    const scope = product
      ? and(eq(requests.contactId, contactId), inArray(requests.id, okReq.length ? okReq : ["00000000-0000-0000-0000-000000000000"]))
      : eq(requests.contactId, contactId);
    // Every call attempt counts as a first response (for the response-time metric) …
    await db
      .update(requests)
      .set({ firstContactedAt: now, assignedTo: user.uid })
      .where(and(scope, isNull(requests.firstContactedAt)));
    // … but only a real conversation moves "Yeni" → "Arandı".
    if (status === "reached") {
      const open = await db
        .select({ id: requests.id })
        .from(requests)
        .where(and(scope, eq(requests.stage, "new")));
      for (const r of open) await moveStage(r.id, "followup");
    }
  }
  await db.update(contacts).set({ updatedAt: now }).where(eq(contacts.id, contactId));
  refresh(contactId);
  return { ok: true, at: now.getTime() };
}

/** Builds the WhatsApp message, logs it, and returns the wa.me link for the browser to open. */
export async function whatsappMessage(contactId: string, ref: { requestId?: string | null; policyId?: string | null; product?: string | null }, templateId: string) {
  const user = await requireUser();
  const db = await getDb();
  const c = await loadContact(contactId);
  const r = ref.requestId ? await loadRequest(ref.requestId) : null;
  const [pol] = ref.policyId ? await db.select().from(policies).where(eq(policies.id, uuid.parse(ref.policyId))) : [];
  const product = r?.product ?? pol?.product ?? ref.product ?? null;
  const t = [...WHATSAPP_TEMPLATES, ...CUSTOMER_WHATSAPP_TEMPLATES].find((x) => x.id === templateId);
  const text = t
    ? t.text
        .replaceAll("{ad}", (c.kind === "kurumsal" ? (c.contactPerson ?? c.fullName) : c.fullName).split(" ")[0])
        .replaceAll("{temsilci}", user.name.split(" ")[0])
        .replaceAll("{urun}", product ? productLabel(product) : "")
        .replaceAll("{tarih}", pol?.endDate ? fmtYmd(pol.endDate) : "")
        .replace(/\(\)/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.,])/g, "$1")
    : "";
  await db.insert(activities).values({
    contactId: c.id,
    requestId: r?.id ?? null,
    userId: user.uid,
    type: "whatsapp",
    body: t ? `WhatsApp: "${t.label}" mesajı açıldı${product ? ` (${productLabel(product)})` : ""}` : "WhatsApp sohbeti açıldı",
    meta: { template: templateId },
  });
  if (r && !r.firstContactedAt)
    await db.update(requests).set({ firstContactedAt: new Date(), assignedTo: r.assignedTo ?? user.uid }).where(eq(requests.id, r.id));
  refresh(c.id);
  return { url: `https://wa.me/90${c.phone}${text ? `?text=${encodeURIComponent(text)}` : ""}` };
}

/** Opens WhatsApp with a free-text message (e.g. the AI-suggested one) and logs it. */
export async function whatsappCustom(contactId: string, text: string) {
  const user = await requireUser();
  const c = await loadContact(contactId);
  const first = (c.kind === "kurumsal" ? (c.contactPerson ?? c.fullName) : c.fullName).split(" ")[0];
  const msg = text.slice(0, 2000).replaceAll("{ad}", first).replaceAll("{temsilci}", user.name.split(" ")[0]);
  const db = await getDb();
  await db.insert(activities).values({ contactId: c.id, userId: user.uid, type: "whatsapp", body: "WhatsApp: AI önerisi mesaj açıldı", meta: { text: msg } });
  refresh(c.id);
  return { url: `https://wa.me/90${c.phone}?text=${encodeURIComponent(msg)}` };
}

/* ------------------------------------------------------------ request fields */

export async function assignRequest(requestId: string, userId: string) {
  const user = await requireUser();
  const r = await loadRequest(requestId);
  const db = await getDb();
  const to = userId ? uuid.parse(userId) : null;
  await db.update(requests).set({ assignedTo: to, updatedAt: new Date() }).where(eq(requests.id, r.id));
  const team = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  await db.insert(activities).values({
    contactId: r.contactId,
    requestId: r.id,
    userId: user.uid,
    type: "assign",
    body: to ? `${team.find((u) => u.id === to)?.name ?? "?"} sorumlu yapıldı` : "Sorumlu kaldırıldı",
  });
  refresh(r.contactId);
}

/** Fixes a request's product (e.g. a lead form whose product couldn't be guessed). */
export async function setRequestProduct(requestId: string, product: string) {
  const user = await requireUser();
  if (!PRODUCT_CODES.includes(product)) throw new Error("Geçersiz ürün");
  const r = await loadRequest(requestId);
  if (r.product === product) return;
  const db = await getDb();
  await db.update(requests).set({ product, updatedAt: new Date() }).where(eq(requests.id, r.id));
  await db.insert(activities).values({
    contactId: r.contactId,
    requestId: r.id,
    userId: user.uid,
    type: "system",
    body: `Talebin ürünü değiştirildi: ${productLabel(r.product)} → ${productLabel(product)}`,
  });
  refresh(r.contactId);
}

export async function updateQuote(requestId: string, amount: string) {
  await requireUser();
  const r = await loadRequest(requestId);
  const db = await getDb();
  await db.update(requests).set({ quoteAmount: parseMoney(amount), updatedAt: new Date() }).where(eq(requests.id, r.id));
  refresh(r.contactId);
}

/** Opens a new request for an existing person (cross-sell from the customer profile). */
export async function openRequest(contactId: string, product: string) {
  const user = await requireUser();
  if (!PRODUCT_CODES.includes(product)) throw new Error("Geçersiz ürün");
  const c = await loadContact(contactId);
  const db = await getDb();
  const [existing] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.contactId, c.id), eq(requests.product, product), inArray(requests.stage, OPEN_STAGES)));
  if (existing) return { error: `${productLabel(product)} için zaten açık bir talep var.` };
  const [r] = await db
    .insert(requests)
    .values({
      contactId: c.id,
      product,
      source: c.lifecycle === "customer" ? "existing_customer" : "other",
      stage: "followup",
      callStatus: "awaiting",
      firstContactedAt: new Date(),
      assignedTo: user.uid,
    })
    .returning({ id: requests.id });
  await db.insert(activities).values({
    contactId: c.id,
    requestId: r.id,
    userId: user.uid,
    type: "form",
    body: `${productLabel(product)} için yeni talep açıldı (ek satış)`,
  });
  refresh(c.id);
  return { ok: true };
}

/* ------------------------------------------------------------------- contact */

const corporateSchema = z.object({
  kind: z.enum(["bireysel", "kurumsal"]).default("bireysel"),
  companyName: z.string().trim().max(200).optional(),
  contactTitle: z.string().trim().max(120).optional(),
  taxNo: z.string().trim().max(20).optional(),
  taxOffice: z.string().trim().max(80).optional(),
  sector: z.string().trim().max(120).optional(),
  employeeCount: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
});

/**
 * Form fields → contact columns. For kurumsal the name field is the contact person and
 * companyName becomes the profile name.
 */
function contactColumns(person: string, c: z.infer<typeof corporateSchema>) {
  if (c.kind !== "kurumsal") {
    return { kind: "bireysel", fullName: person, contactPerson: null, contactTitle: null, taxNo: null, taxOffice: null, sector: null, employeeCount: null, address: null };
  }
  return {
    kind: "kurumsal",
    fullName: c.companyName || person,
    contactPerson: person,
    contactTitle: c.contactTitle || null,
    taxNo: c.taxNo?.replace(/\D/g, "") || null,
    taxOffice: c.taxOffice || null,
    sector: c.sector || null,
    employeeCount: c.employeeCount || null,
    address: c.address || null,
  };
}

const contactSchema = corporateSchema.extend({
  id: uuid,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  birthDate: ymd.optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional(),
  preferredCallTime: z.string().trim().max(80).optional(),
  customerSince: ymd.optional().or(z.literal("")),
  notes: z.string().max(4000).optional(),
});

export async function updateContact(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = contactSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Bilgileri kontrol edin (ad, e-posta, tarih)." };
  if (p.data.kind === "kurumsal" && !p.data.companyName) return { error: "Şirket unvanını girin." };
  const phone = normalizePhone(p.data.phone);
  if (!phone) return { error: "Telefon numarası geçersiz." };
  const db = await getDb();
  const [other] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.kind, p.data.kind), eq(contacts.phone, phone)));
  if (other && other.id !== p.data.id)
    return { error: `Bu telefon numarası başka bir ${p.data.kind === "kurumsal" ? "kurumsal" : "bireysel"} kayıtta var.` };
  const marketing = form.get("marketingConsent") === "on";
  const [before] = await db.select().from(contacts).where(eq(contacts.id, p.data.id));
  const now = new Date();
  await db
    .update(contacts)
    .set({
      ...contactColumns(p.data.fullName, p.data),
      phone,
      email: p.data.email || null,
      city: p.data.city || null,
      birthDate: p.data.kind === "bireysel" ? p.data.birthDate || null : null,
      occupation: p.data.kind === "bireysel" ? p.data.occupation || null : null,
      preferredCallTime: p.data.preferredCallTime || null,
      notes: p.data.notes || null,
      marketingConsent: marketing,
      marketingConsentAt: marketing ? (before?.marketingConsentAt ?? now) : null,
      ...(before?.lifecycle === "customer" && p.data.customerSince
        ? { customerSince: new Date(`${p.data.customerSince}T12:00:00+03:00`) }
        : {}),
      updatedAt: now,
    })
    .where(eq(contacts.id, p.data.id));
  if (before && before.kind !== p.data.kind) {
    await db.insert(activities).values({
      contactId: p.data.id,
      userId: user.uid,
      type: "system",
      body: p.data.kind === "kurumsal" ? "Kurumsal kayda çevrildi" : "Bireysel kayda çevrildi",
    });
  }
  if (before && before.marketingConsent !== marketing) {
    await db.insert(activities).values({
      contactId: p.data.id,
      userId: user.uid,
      type: "system",
      body: marketing ? "Ticari ileti izni verildi" : "Ticari ileti izni geri çekildi",
    });
  }
  refresh(p.data.id);
  return { ok: true, at: now.getTime() };
}

const newContactSchema = corporateSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string(),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  source: z.enum(SOURCES.map((s) => s.code) as [string, ...string[]]),
  note: z.string().max(4000).optional(),
});

function newContactErrors(d: z.infer<typeof newContactSchema>, form: FormData) {
  if (d.kind === "kurumsal" && !d.companyName) return "Şirket unvanını girin.";
  if (form.get("kvkk") !== "on") return "Kaydetmek için KVKK aydınlatmasının yapıldığını onaylayın.";
  if (!normalizePhone(d.phone)) return "Telefon numarası geçersiz.";
  return null;
}

const manualSchema = newContactSchema.extend({ product: z.enum(PRODUCT_CODES) });

export async function createManualLead(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = manualSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Ad, telefon ve sigorta türü gerekli." };
  const err = newContactErrors(p.data, form);
  if (err) return { error: err };
  const res = await ingestLead({
    fullName: p.data.fullName,
    phone: p.data.phone,
    email: p.data.email || null,
    city: p.data.city || null,
    product: p.data.product as never,
    segment: p.data.kind,
    companyName: p.data.companyName || null,
    contactTitle: p.data.contactTitle || null,
    source: p.data.source as never,
    kvkkConsent: true,
    marketingConsent: form.get("marketing") === "on",
    createdBy: user.uid,
  });
  if (!res.ok) return { error: res.error === "invalid_phone" ? "Telefon numarası geçersiz." : "Ad soyad geçersiz." };
  const db = await getDb();
  if (p.data.kind === "kurumsal") {
    // Fill corporate details the intake doesn't know about (only blanks: never overwrite).
    const [c] = await db.select().from(contacts).where(eq(contacts.id, res.contactId));
    const cols = contactColumns(p.data.fullName, p.data);
    await db
      .update(contacts)
      .set({
        taxNo: c.taxNo ?? cols.taxNo,
        taxOffice: c.taxOffice ?? cols.taxOffice,
        sector: c.sector ?? cols.sector,
        employeeCount: c.employeeCount ?? cols.employeeCount,
        address: c.address ?? cols.address,
      })
      .where(eq(contacts.id, res.contactId));
  }
  if (p.data.note?.trim()) {
    await db.insert(activities).values({
      contactId: res.contactId,
      requestId: res.requestId,
      userId: user.uid,
      type: "note",
      body: p.data.note.trim(),
    });
  }
  refresh(res.contactId);
  redirect(`/kisiler/${res.contactId}`);
}

const customerSchema = newContactSchema.extend({
  customerSince: ymd.optional().or(z.literal("")),
  addPolicy: z.literal("on").optional(),
  product: z.enum(PRODUCT_CODES).optional(),
  insurer: z.string().trim().max(80).optional(),
  policyNo: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(200).optional(),
  startDate: ymd.optional().or(z.literal("")),
  endDate: ymd.optional().or(z.literal("")),
  premium: z.string().max(30).optional(),
});

/** "+ Yeni müşteri": someone who is already a customer (e.g. moved over from another agency). */
export async function createCustomer(_: unknown, form: FormData) {
  const user = await requireUser();
  const p = customerSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Ad, telefon ve tarihleri kontrol edin." };
  const d = p.data;
  const err = newContactErrors(d, form);
  if (err) return { error: err };
  if (d.addPolicy && !d.product) return { error: "Poliçe türünü seçin." };
  if (d.addPolicy && !d.endDate) return { error: "Yenileme (bitiş) tarihini girin." };
  const phone = normalizePhone(d.phone)!;
  const db = await getDb();
  const now = new Date();
  const since = d.customerSince ? new Date(`${d.customerSince}T12:00:00+03:00`) : now;
  const cols = contactColumns(d.fullName, d);
  const marketing = form.get("marketing") === "on";

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.kind, cols.kind), eq(contacts.phone, phone)));
    if (existing?.lifecycle === "customer") return { error: "Bu telefon numarasıyla kayıtlı bir müşteri zaten var.", contactId: existing.id };
    let contactId: string;
    if (existing) {
      // Known lead: keep its history, fill blanks, make it a customer.
      contactId = existing.id;
      await tx
        .update(contacts)
        .set({
          email: existing.email ?? (d.email || null),
          city: existing.city ?? (d.city || null),
          ...(cols.kind === "kurumsal"
            ? {
                fullName: existing.fullName === existing.contactPerson ? cols.fullName : existing.fullName,
                taxNo: existing.taxNo ?? cols.taxNo,
                taxOffice: existing.taxOffice ?? cols.taxOffice,
                sector: existing.sector ?? cols.sector,
                employeeCount: existing.employeeCount ?? cols.employeeCount,
                address: existing.address ?? cols.address,
              }
            : {}),
          updatedAt: now,
        })
        .where(eq(contacts.id, existing.id));
      await makeCustomer(tx, existing.id, user.uid, since, "yeni müşteri formundan");
    } else {
      const [c] = await tx
        .insert(contacts)
        .values({
          ...cols,
          phone,
          email: d.email || null,
          city: d.city || null,
          lifecycle: "customer",
          customerSince: since,
          firstSource: d.source,
          ownerId: user.uid,
          kvkkConsent: true,
          kvkkConsentAt: now,
          marketingConsent: marketing,
          marketingConsentAt: marketing ? now : null,
        })
        .returning({ id: contacts.id });
      contactId = c.id;
      await tx.insert(activities).values({ contactId, userId: user.uid, type: "system", body: "Müşteri olarak eklendi" });
    }
    if (d.addPolicy && d.product) {
      await insertPolicy(tx, user.uid, {
        contactId,
        product: d.product,
        insurer: d.insurer || null,
        policyNo: d.policyNo || null,
        subject: d.subject || null,
        startDate: d.startDate || null,
        endDate: d.endDate || null,
        premium: parseMoney(d.premium),
      });
    }
    if (d.note?.trim()) await tx.insert(activities).values({ contactId, userId: user.uid, type: "note", body: d.note.trim() });
    return { contactId };
  });
  if ("error" in result) return { error: result.error };
  refresh(result.contactId);
  redirect(`/kisiler/${result.contactId}`);
}

/* --------------------------------------------------------------- integrations */

/** Re-processes a failed website / Meta delivery from the Entegrasyonlar page. */
export async function retryInbox(id: string) {
  await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(inbox).where(eq(inbox.id, uuid.parse(id)));
  if (!row || row.status === "processed") return;
  const p = row.payload as Record<string, unknown>;
  try {
    const leads =
      row.channel === "website"
        ? websitePayloadToLeads(p)
        : [
            await (async () => {
              const { lead, formName } = await fetchMetaLead(String(p.leadgen_id));
              return metaLeadToIncoming(lead, formName);
            })(),
          ];
    let res: Awaited<ReturnType<typeof ingestLead>> = { ok: false, error: "invalid_phone" };
    for (const lead of leads) {
      const r = await ingestLead(lead);
      if (r.ok && !res.ok) res = r;
      else if (!res.ok) res = r;
    }
    await db
      .update(inbox)
      .set(res.ok ? { status: "processed", error: null, requestId: res.requestId } : { status: "failed", error: res.error })
      .where(eq(inbox.id, row.id));
  } catch (e) {
    await db.update(inbox).set({ status: "failed", error: String(e).slice(0, 500) }).where(eq(inbox.id, row.id));
  }
  revalidatePath("/entegrasyonlar");
}


export type PullMetaResult =
  | { ok: true; forms: number; found: number; imported: number; known: number; failed: number }
  | { ok: false; error: string };

/**
 * "Meta'dan çek": reads the last 90 days of leads from every lead form of the Page and imports
 * the ones the CRM has not seen yet. Safe to press any number of times.
 */
export async function pullMetaLeads(): Promise<PullMetaResult> {
  await requireUser();
  if (!process.env.META_PAGE_ACCESS_TOKEN) return { ok: false, error: "META_PAGE_ACCESS_TOKEN ayarlı değil." };
  let list: Awaited<ReturnType<typeof listRecentMetaLeads>>;
  try {
    list = await listRecentMetaLeads(90);
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
  const db = await getDb();
  const ids = list.leads.map((l) => l.lead.id);
  const known = new Set<string>();
  const retryRows = new Map<string, string>();
  if (ids.length) {
    const fromRequests = await db
      .select({ id: requests.externalId })
      .from(requests)
      .where(inArray(requests.externalId, ids.map((id) => `meta:${id}`)));
    for (const r of fromRequests) if (r.id) known.add(r.id.slice(5));
    // Leads merged into an existing open request keep no externalId; the inbox remembers them.
    // A failed earlier attempt is retried in its own inbox row instead of adding a new one.
    const fromInbox = await db
      .select({ row: inbox.id, status: inbox.status, id: sql<string>`${inbox.payload}->>'leadgen_id'` })
      .from(inbox)
      .where(and(eq(inbox.channel, "meta"), inArray(sql`${inbox.payload}->>'leadgen_id'`, ids)));
    for (const r of fromInbox) {
      if (r.status === "processed") known.add(r.id);
      else if (!known.has(r.id)) retryRows.set(r.id, r.row);
    }
  }

  let imported = 0;
  let failed = 0;
  // Oldest first, so profiles and requests are created in the order people filled the forms.
  for (const { lead, formName } of [...list.leads].reverse()) {
    if (known.has(lead.id)) continue;
    const payload = { leadgen_id: lead.id, form_id: lead.form_id, via: "pull", lead, formName };
    let rowId = retryRows.get(lead.id);
    if (rowId) await db.update(inbox).set({ payload }).where(eq(inbox.id, rowId));
    else [{ id: rowId }] = await db.insert(inbox).values({ channel: "meta", payload }).returning({ id: inbox.id });
    const row = { id: rowId };
    try {
      const res = await ingestLead(metaLeadToIncoming(lead, formName));
      await db
        .update(inbox)
        .set(res.ok ? { status: "processed", requestId: res.requestId } : { status: "failed", error: res.error })
        .where(eq(inbox.id, row.id));
      if (res.ok) imported++;
      else failed++;
    } catch (e) {
      failed++;
      await db.update(inbox).set({ status: "failed", error: String(e).slice(0, 500) }).where(eq(inbox.id, row.id));
    }
  }
  revalidatePath("/entegrasyonlar");
  revalidatePath("/leadler");
  revalidatePath("/talepler");
  revalidatePath("/");
  return { ok: true, forms: list.forms, found: ids.length, imported, known: known.size, failed };
}

/* ------------------------------------------------------------------ tags */

/** Replaces a person's tags (Lead Merkezi side panel). Tags are short free text, de-duplicated. */
export async function setContactTags(contactId: string, tags: string[]) {
  await requireUser();
  const id = uuid.parse(contactId);
  const clean = [...new Set(tags.map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  const db = await getDb();
  await db.update(contacts).set({ tags: clean, updatedAt: new Date() }).where(eq(contacts.id, id));
  refresh(id);
}
