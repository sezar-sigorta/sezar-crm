import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { OPEN_STAGES } from "./constants";
import { todayYmd } from "./format";

const { contacts, requests, activities, users, inbox, policies, reminders, documents } = schema;

export async function countNewLeads() {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(requests).where(eq(requests.stage, "new"));
  return r?.n ?? 0;
}

export async function listUsers() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
}

/** Earliest open alarm of a person (shown on kanban cards and lists). */
const nextAlarm = sql<Date | null>`(select min(${reminders.dueAt}) from ${reminders} where ${reminders.contactId} = ${contacts.id} and ${reminders.doneAt} is null)`.mapWith(
  (v) => (v ? new Date(v) : null),
);

const requestWithContact = {
  id: requests.id,
  contactId: requests.contactId,
  product: requests.product,
  segment: requests.segment,
  source: requests.source,
  sourceDetail: requests.sourceDetail,
  answers: requests.answers,
  stage: requests.stage,
  callStatus: requests.callStatus,
  assignedTo: requests.assignedTo,
  firstContactedAt: requests.firstContactedAt,
  stageChangedAt: requests.stageChangedAt,
  createdAt: requests.createdAt,
  fullName: contacts.fullName,
  phone: contacts.phone,
  email: contacts.email,
  preferredCallTime: contacts.preferredCallTime,
  lifecycle: contacts.lifecycle,
  nextAlarmAt: nextAlarm,
};
export type RequestRow = Awaited<ReturnType<typeof pipeline>>[number];

export async function dashboard() {
  const db = await getDb();
  const now = new Date();
  const startOfDay = new Date(`${todayYmd(now)}T00:00:00+03:00`);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const d7 = new Date(now.getTime() - 7 * 864e5);
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const in60 = todayYmd(new Date(now.getTime() + 60 * 864e5));

  const [waiting, alarms, renewals, [today], [week], bySource, byStage, recent] = await Promise.all([
    db
      .select(requestWithContact)
      .from(requests)
      .innerJoin(contacts, eq(contacts.id, requests.contactId))
      .where(eq(requests.stage, "new"))
      .orderBy(asc(requests.createdAt))
      .limit(20),
    db
      .select({
        id: reminders.id,
        title: reminders.title,
        dueAt: reminders.dueAt,
        kind: reminders.kind,
        contactId: reminders.contactId,
        fullName: contacts.fullName,
        lifecycle: contacts.lifecycle,
      })
      .from(reminders)
      .innerJoin(contacts, eq(contacts.id, reminders.contactId))
      .where(and(isNull(reminders.doneAt), lte(reminders.dueAt, endOfDay)))
      .orderBy(asc(reminders.dueAt))
      .limit(30),
    db
      .select({
        id: policies.id,
        product: policies.product,
        insurer: policies.insurer,
        endDate: policies.endDate,
        contactId: policies.contactId,
        fullName: contacts.fullName,
        phone: contacts.phone,
      })
      .from(policies)
      .innerJoin(contacts, eq(contacts.id, policies.contactId))
      .where(and(eq(policies.status, "active"), lte(policies.endDate, in60)))
      .orderBy(asc(policies.endDate))
      .limit(20),
    db.select({ n: count() }).from(requests).where(gte(requests.createdAt, startOfDay)),
    db.select({ n: count() }).from(requests).where(gte(requests.createdAt, d7)),
    db
      .select({
        source: requests.source,
        total: count(),
        won: sql<number>`count(*) filter (where ${requests.stage} = 'won')`.mapWith(Number),
        contacted: sql<number>`count(*) filter (where ${requests.firstContactedAt} is not null)`.mapWith(Number),
        avgFirstResponseMin: sql<number | null>`avg(extract(epoch from (${requests.firstContactedAt} - ${requests.createdAt})) / 60)`.mapWith(
          (v) => (v == null ? null : Number(v)),
        ),
      })
      .from(requests)
      .where(gte(requests.createdAt, d30))
      .groupBy(requests.source)
      .orderBy(desc(count())),
    db.select({ stage: requests.stage, n: count() }).from(requests).groupBy(requests.stage),
    db
      .select({
        id: activities.id,
        type: activities.type,
        body: activities.body,
        createdAt: activities.createdAt,
        contactId: activities.contactId,
        fullName: contacts.fullName,
        userName: users.name,
      })
      .from(activities)
      .innerJoin(contacts, eq(contacts.id, activities.contactId))
      .leftJoin(users, eq(users.id, activities.userId))
      .orderBy(desc(activities.createdAt))
      .limit(12),
  ]);

  return { waiting, alarms, renewals, today: today?.n ?? 0, week: week?.n ?? 0, bySource, byStage, recent, now };
}

export type PipelineFilters = { q?: string; product?: string; source?: string; assignee?: string; form?: string; campaign?: string };

export async function pipeline(f: PipelineFilters = {}) {
  const db = await getDb();
  const d30 = new Date(Date.now() - 30 * 864e5);
  const where = [
    // Open requests, plus won/lost ones closed in the last 30 days.
    or(inArray(requests.stage, OPEN_STAGES), gte(requests.stageChangedAt, d30)),
  ];
  if (f.product) where.push(eq(requests.product, f.product));
  if (f.source === "other") where.push(sql`${requests.source} not in ('meta', 'website')`);
  else if (f.source) where.push(eq(requests.source, f.source));
  if (f.assignee === "none") where.push(sql`${requests.assignedTo} is null`);
  else if (f.assignee) where.push(eq(requests.assignedTo, f.assignee));
  if (f.form) where.push(sql`${requests.sourceDetail}->>'form' = ${f.form}`);
  if (f.campaign) where.push(sql`${requests.sourceDetail}->>'campaign' = ${f.campaign}`);
  if (f.q) where.push(searchContacts(f.q));
  return db
    .select(requestWithContact)
    .from(requests)
    .innerJoin(contacts, eq(contacts.id, requests.contactId))
    .where(and(...where))
    .orderBy(desc(requests.createdAt))
    .limit(500);
}

function searchContacts(q: string) {
  const term = `%${q.trim()}%`;
  const digits = q.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "");
  return or(
    ilike(contacts.fullName, term),
    ilike(contacts.contactPerson, term),
    digits.length >= 10 ? eq(contacts.taxNo, digits) : undefined,
    ilike(contacts.email, term),
    digits.length >= 3 ? ilike(contacts.phone, `%${digits}%`) : undefined,
  )!;
}

const contactBase = {
  id: contacts.id,
  kind: contacts.kind,
  fullName: contacts.fullName,
  contactPerson: contacts.contactPerson,
  sector: contacts.sector,
  phone: contacts.phone,
  email: contacts.email,
  city: contacts.city,
  firstSource: contacts.firstSource,
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
  customerSince: contacts.customerSince,
  nextAlarmAt: nextAlarm,
};

export async function listLeads(opts: { q?: string; source?: string; stage?: string; kind?: string }) {
  const db = await getDb();
  const rq = db
    .select({
      contactId: requests.contactId,
      products: sql<string[]>`array_agg(distinct ${requests.product})`.as("products"),
      sources: sql<string[]>`array_agg(distinct ${requests.source})`.as("sources"),
      // Most advanced open stage, for a quick status column.
      stage: sql<string | null>`(array_agg(${requests.stage} order by array_position(array['followup','new','lost','won'], ${requests.stage})))[1]`.as(
        "stage",
      ),
      lastAt: sql<Date>`max(${requests.createdAt})`.as("last_at"),
    })
    .from(requests)
    .groupBy(requests.contactId)
    .as("rq");
  const where = [eq(contacts.lifecycle, "lead")];
  if (opts.kind === "bireysel" || opts.kind === "kurumsal") where.push(eq(contacts.kind, opts.kind));
  if (opts.q) where.push(searchContacts(opts.q));
  if (opts.source) where.push(sql`${opts.source} = any(${rq.sources})`);
  if (opts.stage) where.push(eq(rq.stage, opts.stage));
  return db
    .select({ ...contactBase, products: rq.products, sources: rq.sources, stage: rq.stage, lastAt: rq.lastAt })
    .from(contacts)
    .leftJoin(rq, eq(rq.contactId, contacts.id))
    .where(and(...where))
    .orderBy(sql`${rq.lastAt} desc nulls last`)
    .limit(500);
}

export async function listCustomers(opts: { q?: string; renewal?: string; kind?: string }) {
  const db = await getDb();
  const pol = db
    .select({
      contactId: policies.contactId,
      products: sql<string[]>`array_agg(distinct ${policies.product})`.as("products"),
      activeCount: count().as("active_count"),
      // Earliest renewal of an active policy, overdue ones included (they are the most urgent).
      nextRenewal: sql<string | null>`min(${policies.endDate})`.as("next_renewal"),
      premium: sql<string | null>`sum(${policies.premium})`.as("premium"),
    })
    .from(policies)
    .where(eq(policies.status, "active"))
    .groupBy(policies.contactId)
    .as("pol");
  const where = [eq(contacts.lifecycle, "customer")];
  if (opts.kind === "bireysel" || opts.kind === "kurumsal") where.push(eq(contacts.kind, opts.kind));
  if (opts.q) where.push(searchContacts(opts.q));
  if (opts.renewal === "30" || opts.renewal === "90") {
    const until = todayYmd(new Date(Date.now() + Number(opts.renewal) * 864e5));
    where.push(lte(pol.nextRenewal, until));
  }
  return db
    .select({
      ...contactBase,
      products: pol.products,
      activeCount: sql<number>`coalesce(${pol.activeCount}, 0)`.mapWith(Number),
      nextRenewal: pol.nextRenewal,
      premium: pol.premium,
    })
    .from(contacts)
    .leftJoin(pol, eq(pol.contactId, contacts.id))
    .where(and(...where))
    .orderBy(sql`${pol.nextRenewal} asc nulls last`, asc(contacts.fullName))
    .limit(500);
}

export async function contactDetail(id: string) {
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!contact) return null;
  const [reqs, acts, pols, alarms, team, docs] = await Promise.all([
    db.select().from(requests).where(eq(requests.contactId, id)).orderBy(desc(requests.createdAt)),
    db
      .select({
        id: activities.id,
        type: activities.type,
        body: activities.body,
        meta: activities.meta,
        requestId: activities.requestId,
        createdAt: activities.createdAt,
        userName: users.name,
      })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.userId))
      .where(eq(activities.contactId, id))
      .orderBy(desc(activities.createdAt))
      .limit(200),
    db
      .select()
      .from(policies)
      .where(eq(policies.contactId, id))
      .orderBy(sql`case ${policies.status} when 'active' then 0 else 1 end`, asc(policies.endDate)),
    db
      .select()
      .from(reminders)
      .where(eq(reminders.contactId, id))
      .orderBy(sql`${reminders.doneAt} is not null`, asc(reminders.dueAt))
      .limit(100),
    listUsers(),
    db.select().from(documents).where(eq(documents.contactId, id)).orderBy(desc(documents.createdAt)),
  ]);
  return { contact, requests: reqs, activities: acts, policies: pols, reminders: alarms, team, documents: docs };
}

export async function recentInbox() {
  const db = await getDb();
  return db.select().from(inbox).orderBy(desc(inbox.createdAt)).limit(50);
}

/* ------------------------------------------------------------------ reports */

export type ReportGroup = "form" | "campaign" | "ad";

// The key is inlined (not a bind parameter) so SELECT and GROUP BY are the same expression for Postgres.
const detail = (k: "form" | "campaign" | "ad") => sql<string | null>`${requests.sourceDetail}->>${sql.raw(`'${k}'`)}`;

/**
 * Lead performance per form, campaign or ad: how many came in, how many were reached, won, lost,
 * the conversion rate, first-response time and the most common lost reason.
 * Requests without that detail (e.g. entered by hand) are grouped by source.
 */
export async function campaignReport(group: ReportGroup, days: number | null) {
  const db = await getDb();
  const key = group === "form" ? detail("form") : group === "campaign" ? detail("campaign") : detail("ad");
  const parent = group === "ad" ? detail("campaign") : sql<string | null>`null`;
  const where = days ? gte(requests.createdAt, new Date(Date.now() - days * 864e5)) : undefined;
  const rows = await db
    .select({
      source: requests.source,
      key: sql<string | null>`${key}`,
      parent: sql<string | null>`${parent}`,
      total: count(),
      reached: sql<number>`count(*) filter (where ${requests.stage} <> 'new')`.mapWith(Number),
      won: sql<number>`count(*) filter (where ${requests.stage} = 'won')`.mapWith(Number),
      lost: sql<number>`count(*) filter (where ${requests.stage} = 'lost')`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${requests.stage} in ('new', 'followup'))`.mapWith(Number),
      waiting: sql<number>`count(*) filter (where ${requests.stage} = 'new')`.mapWith(Number),
      avgFirstResponseMin: sql<number | null>`avg(extract(epoch from (${requests.firstContactedAt} - ${requests.createdAt})) / 60)`.mapWith((v) =>
        v == null ? null : Number(v),
      ),
      topLostReason: sql<string | null>`mode() within group (order by ${requests.lostReason}) filter (where ${requests.stage} = 'lost')`,
      products: sql<string[]>`array_agg(distinct ${requests.product})`,
      first: sql<Date>`min(${requests.createdAt})`.mapWith((v) => new Date(v)),
      last: sql<Date>`max(${requests.createdAt})`.mapWith((v) => new Date(v)),
    })
    .from(requests)
    .where(where)
    // Only ads have a parent (their campaign); grouping by a constant NULL is an error in Postgres.
    .groupBy(...(group === "ad" ? [requests.source, key, parent] : [requests.source, key]))
    .orderBy(desc(count()));
  return rows;
}

/** Distinct form and campaign names, for the Talepler filters. */
export async function formAndCampaignNames() {
  const db = await getDb();
  const [forms, campaigns] = await Promise.all([
    db
      .selectDistinct({ v: sql<string>`${requests.sourceDetail}->>'form'` })
      .from(requests)
      .where(sql`${requests.sourceDetail}->>'form' is not null`),
    db
      .selectDistinct({ v: sql<string>`${requests.sourceDetail}->>'campaign'` })
      .from(requests)
      .where(sql`${requests.sourceDetail}->>'campaign' is not null`),
  ]);
  const sort = (a: { v: string }[]) => a.map((x) => x.v).sort((x, y) => x.localeCompare(y, "tr"));
  return { forms: sort(forms), campaigns: sort(campaigns) };
}

/** One request with its person, for the Lead Merkezi side panel. */
export async function leadDetail(requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ request: requests, contact: contacts })
    .from(requests)
    .innerJoin(contacts, eq(contacts.id, requests.contactId))
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!row) return null;
  const others = await db
    .select({ id: requests.id, product: requests.product, stage: requests.stage, source: requests.source, createdAt: requests.createdAt })
    .from(requests)
    .where(and(eq(requests.contactId, row.contact.id), sql`${requests.id} <> ${requestId}`))
    .orderBy(desc(requests.createdAt))
    .limit(10);
  const [notes, alarms, tagRows] = await Promise.all([
    db
      .select({ id: activities.id, type: activities.type, body: activities.body, createdAt: activities.createdAt, userName: users.name })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.userId))
      .where(and(eq(activities.contactId, row.contact.id), inArray(activities.type, ["note", "call"])))
      .orderBy(desc(activities.createdAt))
      .limit(5),
    db
      .select({ id: reminders.id, title: reminders.title, dueAt: reminders.dueAt, kind: reminders.kind })
      .from(reminders)
      .where(and(eq(reminders.contactId, row.contact.id), isNull(reminders.doneAt)))
      .orderBy(asc(reminders.dueAt))
      .limit(5),
    // Every tag in use, for suggestions in the tag box.
    db.select({ tag: sql<string>`distinct unnest(${contacts.tags})` }).from(contacts),
  ]);
  return { ...row, others, notes, alarms, allTags: tagRows.map((t) => t.tag).sort((a, b) => a.localeCompare(b, "tr")) };
}
