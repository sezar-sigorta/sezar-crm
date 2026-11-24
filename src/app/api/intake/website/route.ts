import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ingestLead } from "@/lib/ingest";
import { safeEqual } from "@/lib/secrets";
import { websitePayloadToLeads } from "@/lib/website";

// Called by the WordPress theme on sezarsigorta.com for every quote / call-back form.
// Auth: header "x-sezar-secret" must equal WEBSITE_INTAKE_SECRET.

export async function POST(req: Request) {
  const secret = process.env.WEBSITE_INTAKE_SECRET;
  const given = req.headers.get("x-sezar-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 20000) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object") throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const db = await getDb();
  const [row] = await db.insert(schema.inbox).values({ channel: "website", payload }).returning({ id: schema.inbox.id });

  try {
    // The product form can ask for a package: one request per product, same person.
    const results = [];
    for (const lead of websitePayloadToLeads(payload)) results.push(await ingestLead(lead));
    const ok = results.filter((r) => r.ok);
    const failed = results.find((r) => !r.ok);
    await db
      .update(schema.inbox)
      .set(
        ok.length
          ? { status: "processed", requestId: ok[0].ok ? ok[0].requestId : null }
          : { status: "failed", error: failed && !failed.ok ? failed.error : "unknown" },
      )
      .where(eq(schema.inbox.id, row.id));
    const result = ok.length ? { ...ok[0], requests: ok.length } : failed;
    return NextResponse.json(result, { status: ok.length ? 200 : 422 });
  } catch (e) {
    await db
      .update(schema.inbox)
      .set({ status: "failed", error: String(e).slice(0, 500) })
      .where(eq(schema.inbox.id, row.id));
    console.error("website intake failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
