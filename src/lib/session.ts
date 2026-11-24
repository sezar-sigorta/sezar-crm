// Session token helpers. Edge-safe (used by middleware): no Node or DB imports here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sz_session";
export const SESSION_DAYS = 14;

export type SessionPayload = { uid: string; name: string; role: string };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
    return new TextEncoder().encode("dev-only-insecure-session-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, name: String(payload.name ?? ""), role: String(payload.role ?? "agent") };
  } catch {
    return null;
  }
}
