import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { getFile } from "@/lib/storage";

// Serves an uploaded document to logged-in users only (middleware also blocks anonymous /api requests).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return new NextResponse("unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("not found", { status: 404 });
  const db = await getDb();
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
  if (!doc) return new NextResponse("not found", { status: 404 });
  const data = await getFile(doc.storageKey);
  const download = new URL(req.url).searchParams.has("indir");
  const name = encodeURIComponent(doc.fileName);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'self'",
    },
  });
}
