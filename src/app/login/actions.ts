"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, SESSION_DAYS, signSession } from "@/lib/session";

// Simple in-memory brake against password guessing (per server instance).
const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const a = attempts.get(email);
  if (a && a.n >= 5 && a.until > Date.now()) return { error: "Çok fazla deneme. 10 dakika sonra tekrar deneyin." };

  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  const ok = u ? await bcrypt.compare(password, u.passwordHash) : await bcrypt.compare(password, DUMMY);
  if (!u || !ok) {
    const n = (a && a.until > Date.now() ? a.n : 0) + 1;
    attempts.set(email, { n, until: Date.now() + 10 * 60_000 });
    return { error: "E-posta ya da şifre hatalı." };
  }
  attempts.delete(email);

  const token = await signSession({ uid: u.id, name: u.name, role: u.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// Equalises timing when the e-mail doesn't exist.
const DUMMY = bcrypt.hashSync("not-a-real-password", 10);
