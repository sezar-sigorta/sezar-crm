"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { AiError, aiEnabled, readPolicyDocument, type PolicyExtraction } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, deleteFile, getFile, putFile, sniffType } from "@/lib/storage";

const { documents, activities, contacts } = schema;
const uuid = z.string().uuid();

function refresh(contactId: string) {
  revalidatePath(`/kisiler/${contactId}`);
}

/** Upload a policy PDF / photo (or any other PDF / image) to a person's profile. */
export async function uploadDocument(_: unknown, form: FormData) {
  const user = await requireUser();
  const contactId = uuid.safeParse(form.get("contactId"));
  const file = form.get("file");
  if (!contactId.success || !(file instanceof File)) return { error: "Dosya seçin." };
  if (file.size === 0) return { error: "Dosya boş." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Dosya 10 MB'tan büyük olamaz." };
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (!type) return { error: "Sadece PDF, JPG, PNG ya da WEBP yüklenebilir." };

  const db = await getDb();
  const [c] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId.data));
  if (!c) return { error: "Kişi bulunamadı." };

  const id = randomUUID();
  const storageKey = `${c.id}/${id}.${type.ext}`;
  await putFile(storageKey, data, type.mime);
  const fileName = (file.name || `belge.${type.ext}`).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 150);
  await db.insert(documents).values({ id, contactId: c.id, fileName, mimeType: type.mime, size: data.length, storageKey, createdBy: user.uid });
  await db.insert(activities).values({ contactId: c.id, userId: user.uid, type: "system", body: `Belge yüklendi: ${fileName}` });
  refresh(c.id);
  return { ok: true, id, at: Date.now() };
}

export async function deleteDocument(id: string) {
  const user = await requireUser();
  const db = await getDb();
  const [d] = await db.select().from(documents).where(eq(documents.id, uuid.parse(id)));
  if (!d) return;
  await db.delete(documents).where(eq(documents.id, d.id));
  await deleteFile(d.storageKey);
  await db.insert(activities).values({ contactId: d.contactId, userId: user.uid, type: "system", body: `Belge silindi: ${d.fileName}` });
  refresh(d.contactId);
}

/** "AI ile oku": reads the document and returns policy fields for the user to check before saving. */
export async function readDocumentWithAi(id: string): Promise<{ ok: true; extraction: PolicyExtraction } | { error: string }> {
  await requireUser();
  if (!aiEnabled()) return { error: "AI kapalı: ANTHROPIC_API_KEY tanımlı değil." };
  const db = await getDb();
  const [d] = await db.select().from(documents).where(eq(documents.id, uuid.parse(id)));
  if (!d) return { error: "Belge bulunamadı." };
  try {
    const extraction = await readPolicyDocument(await getFile(d.storageKey), d.mimeType);
    await db.update(documents).set({ extraction, extractedAt: new Date() }).where(eq(documents.id, d.id));
    refresh(d.contactId);
    return { ok: true, extraction };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    console.error("AI document read failed", e);
    return { error: "Belge okunamadı, tekrar deneyin." };
  }
}
