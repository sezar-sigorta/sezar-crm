// A policy issued online on sezarsigorta.com (the AXA quote pages), sent by the WordPress theme
// after the customer paid:
//   { type: 'police', form, pol, c: { ad, tel }, sigortaci, policeNo, urun, prim, baslangic, bitis, konu, page }
// The matching open request is closed as won, the person becomes a customer and the policy is
// recorded with its renewal alarms. The same policy number is never recorded twice.
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { OPEN_STAGES, productLabel, stage as stageOf } from "./constants";
import { ingestLead } from "./ingest";
import { normalizePhone } from "./phone";
import { insertPolicy, makeCustomer } from "./policies";
import { SITE_PRODUCTS } from "./website";

const { contacts, requests, activities, policies } = schema;

type Payload = Record<string, unknown>;
const str = (v: unknown, max = 200) => (v == null ? "" : String(v)).trim().slice(0, max);
const ymd = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : null);

export type OnlinePolicyResult =
  | { ok: true; contactId: string; requestId: string; policyId: string | null; created: "policy" | "duplicate" }
  | { ok: false; error: "invalid_phone" | "invalid_name" | "invalid_policy" };

export async function recordOnlinePolicy(d: Payload): Promise<OnlinePolicyResult> {
  const c = (d.c && typeof d.c === "object" ? d.c : {}) as Payload;
  const phone = normalizePhone(str(c.tel));
  if (!phone) return { ok: false, error: "invalid_phone" };
  const product = SITE_PRODUCTS[str(d.pol)];
  const policyNo = str(d.policeNo, 80);
  if (!product || !policyNo) return { ok: false, error: "invalid_policy" };
  const insurer = str(d.sigortaci, 80) || null;
  const premium = Number(d.prim);
  const answers: Record<string, string> = {
    Durum: "Poliçe düzenlendi (online ödendi)",
    [`${insurer ?? "Sigortacı"} poliçe no`]: policyNo,
  };

  const db = await getDb();
  const byPhone = and(eq(contacts.kind, "bireysel"), eq(contacts.phone, phone));
  const openRequest = async (contactId: string) =>
    (
      await db
        .select({ id: requests.id })
        .from(requests)
        .where(and(eq(requests.contactId, contactId), eq(requests.product, product), inArray(requests.stage, OPEN_STAGES)))
        .orderBy(desc(requests.createdAt))
        .limit(1)
    )[0];

  const findPolicy = (contactId: string) =>
    db
      .select({ id: policies.id, requestId: policies.requestId })
      .from(policies)
      .where(and(eq(policies.contactId, contactId), eq(policies.policyNo, policyNo), insurer ? eq(policies.insurer, insurer) : undefined))
      .limit(1);

  let [contact] = await db.select({ id: contacts.id }).from(contacts).where(byPhone);
  // The site may send the same notice again (the customer reloads the page).
  const [known] = contact ? await findPolicy(contact.id) : [];
  if (contact && known?.requestId) {
    return { ok: true, contactId: contact.id, requestId: known.requestId, policyId: known.id, created: "duplicate" };
  }

  // Normally the quote already created the person and the request. If that forward failed,
  // create them now from this notice.
  let open = contact ? await openRequest(contact.id) : undefined;
  if (!contact || !open) {
    const r = await ingestLead({
      fullName: str(c.ad, 120),
      phone,
      product,
      segment: "bireysel",
      source: "website",
      sourceDetail: { page: str(d.page) || "/", form: str(d.form) || "Online poliçe" },
      answers: { Kanal: "Online poliçe", ...answers },
    });
    if (!r.ok) return r;
    contact = { id: r.contactId };
    open = { id: r.requestId };
  }
  const contactId = contact.id;
  const requestId = open.id;

  const now = new Date();
  return db.transaction(async (tx) => {
    const [dup] = await tx
      .select({ id: policies.id, requestId: policies.requestId })
      .from(policies)
      .where(and(eq(policies.contactId, contactId), eq(policies.policyNo, policyNo), insurer ? eq(policies.insurer, insurer) : undefined));
    if (dup) return { ok: true as const, contactId, requestId: dup.requestId ?? requestId, policyId: dup.id, created: "duplicate" as const };

    const [r] = await tx.select().from(requests).where(eq(requests.id, requestId));
    if (r.stage !== "won") {
      await tx
        .update(requests)
        .set({ stage: "won", stageChangedAt: now, closedAt: now, updatedAt: now, answers: { ...r.answers, ...answers } })
        .where(eq(requests.id, r.id));
      await tx.insert(activities).values({
        contactId,
        requestId: r.id,
        type: "stage",
        body: `${productLabel(product)}: ${stageOf(r.stage).label} → Kazanıldı (online poliçe${insurer ? `, ${insurer}` : ""} no ${policyNo})`,
        meta: { from: r.stage, to: "won", online: true },
        createdAt: now,
      });
    }
    await makeCustomer(tx, contactId, null, now, "online poliçe");
    const policyId = await insertPolicy(tx, null, {
      contactId,
      requestId: r.id,
      product,
      insurer,
      policyNo,
      subject: str(d.konu, 200) || null,
      startDate: ymd(d.baslangic),
      endDate: ymd(d.bitis),
      premium: Number.isFinite(premium) && premium > 0 ? premium.toFixed(2) : null,
      notes: str(d.urun) ? `${str(d.urun)} · siteden online satın alındı` : "Siteden online satın alındı",
    });
    return { ok: true as const, contactId, requestId: r.id, policyId, created: "policy" as const };
  });
}
