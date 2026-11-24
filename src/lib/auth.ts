import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, type SessionPayload, verifySession } from "./session";

/** The logged-in user, or a redirect to /login. Use in every page and server action. */
export async function requireUser(): Promise<SessionPayload> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) redirect("/login");
  const db = await getDb();
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u) redirect("/login");
  return s;
}
