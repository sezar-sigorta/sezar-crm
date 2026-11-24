import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ingestLead } from "@/lib/ingest";
import { fetchMetaLead, metaLeadToIncoming } from "@/lib/meta";
import { safeEqual, validMetaSignature } from "@/lib/secrets";

// Meta webhook for Lead Ads ("leadgen" field of the Page object).
// Setup: developers.facebook.com → your app → Webhooks → Page → subscribe to "leadgen",
// callback URL https://<crm>/api/meta/webhook, verify token = META_VERIFY_TOKEN.

/** Meta's one-time verification handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.META_VERIFY_TOKEN ?? "";
  if (
    u.searchParams.get("hub.mode") === "subscribe" &&
    token &&
    safeEqual(u.searchParams.get("hub.verify_token") ?? "", token)
  ) {
    return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type Change = { field?: string; value?: { leadgen_id?: string; form_id?: string; page_id?: string } };
type Body = { object?: string; entry?: { changes?: Change[] }[] };

export async function POST(req: Request) {
  const raw = await req.text();
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !validMetaSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("bad signature", { status: 401 });
  }
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const db = await getDb();
  const ids = (body.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .filter((c) => c.field === "leadgen" && c.value?.leadgen_id)
    .map((c) => c.value!);

  for (const v of ids) {
    const [row] = await db
      .insert(schema.inbox)
      .values({ channel: "meta", payload: v as Record<string, unknown> })
      .returning({ id: schema.inbox.id });
    try {
      const { lead, formName } = await fetchMetaLead(v.leadgen_id!);
      const result = await ingestLead(metaLeadToIncoming(lead, formName));
      await db
        .update(schema.inbox)
        .set(
          result.ok
            ? { status: "processed", requestId: result.requestId, payload: { ...v, lead, formName } }
            : { status: "failed", error: result.error, payload: { ...v, lead, formName } },
        )
        .where(eq(schema.inbox.id, row.id));
    } catch (e) {
      console.error("meta lead failed", v.leadgen_id, e);
      await db
        .update(schema.inbox)
        .set({ status: "failed", error: String(e).slice(0, 500) })
        .where(eq(schema.inbox.id, row.id));
    }
  }
  // Always 200 once the signature is valid: failures are kept in the inbox and can be retried
  // from the Entegrasyonlar page, instead of Meta retrying for hours.
  return NextResponse.json({ ok: true });
}
