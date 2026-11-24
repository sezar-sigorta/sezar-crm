import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** People who log in to the CRM (the Sezar team). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("agent"), // admin | agent
  createdAt: createdAt(),
});

/**
 * A person (profile). One row per phone number: every form a person fills,
 * from any channel, lands on the same profile.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** bireysel | kurumsal */
    kind: text("kind").notNull().default("bireysel"),
    /** Person's name, or the company's title (unvan) for kurumsal. */
    fullName: text("full_name").notNull(),
    /** Normalised Turkish number, digits only without country code, e.g. 5321234567. For kurumsal: the contact person's. */
    phone: text("phone").notNull(),
    // Kurumsal only
    contactPerson: text("contact_person"),
    contactTitle: text("contact_title"),
    taxNo: text("tax_no"),
    taxOffice: text("tax_office"),
    sector: text("sector"),
    employeeCount: text("employee_count"),
    address: text("address"),
    email: text("email"),
    city: text("city"),
    birthDate: text("birth_date"), // YYYY-MM-DD, optional
    occupation: text("occupation"),
    notes: text("notes"),
    /** lead until converted (or a request is won), then customer. */
    lifecycle: text("lifecycle").notNull().default("lead"),
    customerSince: timestamp("customer_since", { withTimezone: true }),
    kvkkConsent: boolean("kvkk_consent").notNull().default(false),
    kvkkConsentAt: timestamp("kvkk_consent_at", { withTimezone: true }),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    preferredCallTime: text("preferred_call_time"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    firstSource: text("first_source"),
    /** Last AI profile analysis (see src/lib/ai.ts → ProfileAnalysis). */
    aiAnalysis: jsonb("ai_analysis").$type<Record<string, unknown>>(),
    aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // A person and the company they represent may share a phone number, so it is unique per kind.
  (t) => [uniqueIndex("contacts_kind_phone_uq").on(t.kind, t.phone), index("contacts_created_idx").on(t.createdAt)],
);

/**
 * A request for one insurance product (talep). This is what moves through the
 * pipeline: Yeni → Ulaşıldı → Bilgi bekleniyor → Teklif verildi → Kazanıldı / Kaybedildi.
 */
export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    product: text("product").notNull().default("genel"),
    segment: text("segment").notNull().default("bireysel"), // bireysel | kurumsal
    source: text("source").notNull(), // website | meta | whatsapp | phone | referral | ...
    /** Campaign / ad / form / page information about where the lead came from. */
    sourceDetail: jsonb("source_detail").$type<Record<string, string>>().notNull().default({}),
    /** Answers from the form, as label → value. */
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    stage: text("stage").notNull().default("new"),
    /** Only for stage "followup": soft_no (yumuşak red) | neutral (nötr) | awaiting (dönüş bekliyoruz). */
    callStatus: text("call_status"),
    lostReason: text("lost_reason"),
    quoteAmount: numeric("quote_amount", { precision: 12, scale: 2 }),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Id from the source system (Meta leadgen id) so the same lead is never imported twice. */
    externalId: text("external_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("requests_external_uq").on(t.externalId),
    index("requests_contact_idx").on(t.contactId),
    index("requests_stage_idx").on(t.stage),
    index("requests_created_idx").on(t.createdAt),
  ],
);

/** Timeline of everything that happened with a person. */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => requests.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** form | note | call | whatsapp | stage | assign | followup | system */
    type: text("type").notNull(),
    body: text("body"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activities_contact_idx").on(t.contactId, t.createdAt)],
);

/** An insurance policy a customer holds. Phase 2 will fill these from uploaded PDFs. */
export const policies = pgTable(
  "policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => requests.id, { onDelete: "set null" }),
    product: text("product").notNull(),
    insurer: text("insurer"),
    policyNo: text("policy_no"),
    /** What is insured: plate, address, people covered… */
    subject: text("subject"),
    startDate: text("start_date"), // YYYY-MM-DD
    /** Renewal date (poliçe bitiş / yenileme tarihi). */
    endDate: text("end_date"), // YYYY-MM-DD
    premium: numeric("premium", { precision: 12, scale: 2 }),
    /** active | renewed | cancelled */
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("policies_contact_idx").on(t.contactId), index("policies_end_idx").on(t.endDate)],
);

/** Alarms: "call X on this date". Manual ones, plus automatic renewal reminders for policies. */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => requests.id, { onDelete: "set null" }),
    policyId: uuid("policy_id").references(() => policies.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    /** manual | renewal */
    kind: text("kind").notNull().default("manual"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_due_idx").on(t.dueAt), index("reminders_contact_idx").on(t.contactId)],
);

/** Uploaded files (policy PDFs, photos of policies, other documents). Bytes live in storage, see src/lib/storage.ts. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id").references(() => policies.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    /** What AI read from the file (see src/lib/ai.ts → PolicyExtraction). */
    extraction: jsonb("extraction").$type<Record<string, unknown>>(),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("documents_contact_idx").on(t.contactId)],
);

/** Raw payloads received from Meta / the website, kept for debugging and replay. */
export const inbox = pgTable("inbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: text("channel").notNull(), // website | meta
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("received"), // received | processed | failed
  error: text("error"),
  requestId: uuid("request_id"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Document = typeof documents.$inferSelect;
