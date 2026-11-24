import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { OPEN_STAGES, type ProductCode, type SourceCode, productLabel, sourceLabel } from "./constants";
import { normalizePhone } from "./phone";

const { contacts, requests, activities } = schema;

export type IncomingLead = {
  fullName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  /** YYYY-MM-DD */
  birthDate?: string | null;
  product: ProductCode;
  segment?: "bireysel" | "kurumsal";
  /** Kurumsal: company title. When missing the person's name is used until someone fills it in. */
  companyName?: string | null;
  contactTitle?: string | null;
  source: SourceCode;
  sourceDetail?: Record<string, string>;
  answers?: Record<string, string>;
  kvkkConsent?: boolean;
  marketingConsent?: boolean;
  preferredCallTime?: string | null;
  /** Id in the source system; the same id is never imported twice. */
  externalId?: string | null;
  receivedAt?: Date;
  /** Logged-in user creating it by hand. */
  createdBy?: string | null;
};

export type IngestResult =
  | { ok: true; contactId: string; requestId: string; created: "request" | "merged" | "duplicate" }
  | { ok: false; error: "invalid_phone" | "invalid_name" };

/** Same person asking for the same product again within this window is merged into the open request. */
const MERGE_WINDOW_DAYS = 7;

/**
 * Turns an incoming form (website, Meta, manual) into a profile + request.
 * - The profile is found or created by phone number; blank fields are filled, consents only ever turn on.
 * - A request is created unless the same person already has an open request for the same product
 *   from the last few days, in which case the new form is added to that request's timeline.
 */
export async function ingestLead(lead: IncomingLead): Promise<IngestResult> {
  const phone = normalizePhone(lead.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const fullName = lead.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2) return { ok: false, error: "invalid_name" };

  const db = await getDb();
  const now = lead.receivedAt ?? new Date();
  const kind = lead.segment === "kurumsal" ? "kurumsal" : "bireysel";
  const company = lead.companyName?.trim() || null;
  const byPhone = and(eq(contacts.kind, kind), eq(contacts.phone, phone));

  return db.transaction(async (tx) => {
    if (lead.externalId) {
      const [dup] = await tx
        .select({ id: requests.id, contactId: requests.contactId })
        .from(requests)
        .where(eq(requests.externalId, lead.externalId));
      if (dup) return { ok: true as const, contactId: dup.contactId, requestId: dup.id, created: "duplicate" as const };
    }

    // Find or create the profile.
    let [contact] = await tx.select().from(contacts).where(byPhone);
    if (!contact) {
      [contact] = await tx
        .insert(contacts)
        .values({
          kind,
          fullName: kind === "kurumsal" ? (company ?? fullName) : fullName,
          contactPerson: kind === "kurumsal" ? fullName : null,
          contactTitle: kind === "kurumsal" ? lead.contactTitle || null : null,
          phone,
          email: lead.email || null,
          city: lead.city || null,
          birthDate: lead.birthDate || null,
          kvkkConsent: !!lead.kvkkConsent,
          kvkkConsentAt: lead.kvkkConsent ? now : null,
          marketingConsent: !!lead.marketingConsent,
          marketingConsentAt: lead.marketingConsent ? now : null,
          preferredCallTime: lead.preferredCallTime || null,
          firstSource: lead.source,
          ownerId: lead.createdBy ?? null,
        })
        .onConflictDoNothing({ target: [contacts.kind, contacts.phone] })
        .returning();
      if (!contact) [contact] = await tx.select().from(contacts).where(byPhone);
    } else {
      const patch: Partial<typeof contacts.$inferInsert> = { updatedAt: now };
      if (!contact.email && lead.email) patch.email = lead.email;
      if (!contact.city && lead.city) patch.city = lead.city;
      if (!contact.birthDate && lead.birthDate) patch.birthDate = lead.birthDate;
      // A company title arriving later replaces the placeholder (the contact person's name).
      if (kind === "kurumsal" && company && contact.fullName === contact.contactPerson) patch.fullName = company;
      if (kind === "kurumsal" && !contact.contactTitle && lead.contactTitle) patch.contactTitle = lead.contactTitle;
      if (lead.preferredCallTime) patch.preferredCallTime = lead.preferredCallTime;
      if (lead.kvkkConsent && !contact.kvkkConsent) Object.assign(patch, { kvkkConsent: true, kvkkConsentAt: now });
      if (lead.marketingConsent && !contact.marketingConsent)
        Object.assign(patch, { marketingConsent: true, marketingConsentAt: now });
      await tx.update(contacts).set(patch).where(eq(contacts.id, contact.id));
    }

    const formNote = describeForm(lead);

    // Merge into a recent open request for the same product?
    const since = new Date(now.getTime() - MERGE_WINDOW_DAYS * 864e5);
    const [open] = await tx
      .select({ id: requests.id, answers: requests.answers })
      .from(requests)
      .where(
        and(
          eq(requests.contactId, contact.id),
          eq(requests.product, lead.product),
          inArray(requests.stage, OPEN_STAGES),
          gte(requests.createdAt, since),
        ),
      )
      .limit(1);

    if (open && !lead.createdBy) {
      await tx
        .update(requests)
        .set({ answers: { ...open.answers, ...(lead.answers ?? {}) }, updatedAt: now })
        .where(eq(requests.id, open.id));
      await tx.insert(activities).values({
        contactId: contact.id,
        requestId: open.id,
        type: "form",
        body: `Aynı talep için yeniden form doldurdu. ${formNote}`,
        meta: { source: lead.source, sourceDetail: lead.sourceDetail ?? {}, answers: lead.answers ?? {} },
        createdAt: now,
      });
      return { ok: true as const, contactId: contact.id, requestId: open.id, created: "merged" as const };
    }

    const [req] = await tx
      .insert(requests)
      .values({
        contactId: contact.id,
        product: lead.product,
        segment: lead.segment ?? "bireysel",
        source: lead.source,
        sourceDetail: lead.sourceDetail ?? {},
        answers: lead.answers ?? {},
        externalId: lead.externalId || null,
        assignedTo: lead.createdBy ?? contact.ownerId ?? null,
        createdAt: now,
        stageChangedAt: now,
        updatedAt: now,
      })
      .returning({ id: requests.id });

    await tx.insert(activities).values({
      contactId: contact.id,
      requestId: req.id,
      userId: lead.createdBy ?? null,
      type: "form",
      body: lead.createdBy ? `Elle eklendi. ${formNote}` : formNote,
      meta: { source: lead.source, sourceDetail: lead.sourceDetail ?? {}, answers: lead.answers ?? {} },
      createdAt: now,
    });

    return { ok: true as const, contactId: contact.id, requestId: req.id, created: "request" as const };
  });
}

function describeForm(lead: IncomingLead) {
  const parts = [`${productLabel(lead.product)} talebi`, `kaynak: ${sourceLabel(lead.source)}`];
  const d = lead.sourceDetail ?? {};
  if (d.campaign) parts.push(`kampanya: ${d.campaign}`);
  if (d.ad) parts.push(`reklam: ${d.ad}`);
  if (d.page) parts.push(`sayfa: ${d.page}`);
  return parts.join(" · ");
}
