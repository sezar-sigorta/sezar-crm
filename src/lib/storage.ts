import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

// Where uploaded files live.
// - Production (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): a PRIVATE Supabase Storage bucket.
// - Local development: ./.data/files (next to the embedded database, ignored by git).

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "belgeler";
const LOCAL_DIR = path.join(process.cwd(), ".data", "files");

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // New secret keys (sb_secret_…) go in the "apikey" header; legacy service_role JWTs also as Bearer.
  const auth: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  return { url: url.replace(/\/$/, ""), auth };
}

function assertKey(key: string) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.(pdf|jpg|png|webp)$/.test(key)) throw new Error("Geçersiz dosya anahtarı");
}

export async function putFile(key: string, data: Buffer, mimeType: string) {
  assertKey(key);
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { ...sb.auth, "Content-Type": mimeType, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Dosya yüklenemedi (${res.status})`);
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("Dosya depolama ayarlanmamış (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export async function getFile(key: string): Promise<Buffer> {
  assertKey(key);
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${key}`, {
      headers: sb.auth,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Dosya okunamadı (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(path.join(LOCAL_DIR, key));
}

export async function deleteFile(key: string) {
  assertKey(key);
  const sb = supabase();
  if (sb) {
    await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${key}`, { method: "DELETE", headers: sb.auth });
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, key), { force: true });
}

/** Detects the real file type from its first bytes (never trust the browser's MIME type). */
export function sniffType(buf: Buffer): { mime: string; ext: "pdf" | "jpg" | "png" | "webp" } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
