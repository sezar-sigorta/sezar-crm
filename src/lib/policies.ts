// Shared by the server actions and the website intake (online policies from the AXA pages).
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RENEWAL_ALARM_DAYS, productLabel } from "./constants";
import { fmtYmd } from "./format";

const { contacts, activities, policies, reminders } = schema;

export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/** Sets lifecycle=customer (once) and logs it. */
export async function makeCustomer(tx: Tx, contactId: string, userId: string | null, now: Date, why: string) {
  const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
  if (!c || c.lifecycle === "customer") return;
  await tx
    .update(contacts)
    .set({ lifecycle: "customer", customerSince: c.customerSince ?? now, updatedAt: now })
    .where(eq(contacts.id, contactId));
  await tx.insert(activities).values({ contactId, userId, type: "system", body: `Müşteriye dönüştürüldü — ${why}` });
}

export type PolicyInput = {
  contactId: string;
  requestId?: string | null;
  product: string;
  insurer: string | null;
  policyNo: string | null;
  subject?: string | null;
  startDate: string | null;
  endDate: string | null;
  premium: string | null;
  notes?: string | null;
};

/** Renewal alarms at 10:00 Istanbul time, N days before the renewal date (only future ones). */
export async function syncRenewalAlarms(tx: Tx, userId: string | null, policyId: string, contactId: string, product: string, insurer: string | null, endDate: string | null) {
  await tx.delete(reminders).where(and(eq(reminders.policyId, policyId), eq(reminders.kind, "renewal"), isNull(reminders.doneAt)));
  if (!endDate) return;
  const end = new Date(`${endDate}T10:00:00+03:00`);
  for (const days of RENEWAL_ALARM_DAYS) {
    const due = new Date(end.getTime() - days * 864e5);
    if (due <= new Date()) continue;
    await tx.insert(reminders).values({
      contactId,
      policyId,
      dueAt: due,
      kind: "renewal",
      title: `Yenileme: ${productLabel(product)}${insurer ? ` (${insurer})` : ""} — ${days} gün kaldı, bitiş ${fmtYmd(endDate)}`,
      createdBy: userId,
    });
  }
}

export async function insertPolicy(tx: Tx, userId: string | null, p: PolicyInput) {
  const [row] = await tx.insert(policies).values(p).returning({ id: policies.id });
  await syncRenewalAlarms(tx, userId, row.id, p.contactId, p.product, p.insurer, p.endDate);
  await tx.insert(activities).values({
    contactId: p.contactId,
    requestId: p.requestId ?? null,
    userId,
    type: "system",
    body: `Poliçe eklendi: ${productLabel(p.product)}${p.insurer ? ` · ${p.insurer}` : ""}${p.endDate ? ` · yenileme ${fmtYmd(p.endDate)}` : ""}`,
  });
  return row.id;
}
