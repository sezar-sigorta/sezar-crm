// Creates or updates a CRM user.
//   npm run user:add -- ad@sezarsigorta.com "Ad Soyad" [admin|agent]
// The password is asked interactively (not stored in shell history).
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createInterface } from "node:readline";
import { getDb, schema } from "../src/db";

async function ask(q: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Hide typed characters.
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  out._writeToOutput = (s: string) => {
    if (s.includes(q)) out.output.write(s);
  };
  return new Promise<string>((res) =>
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write("\n");
      res(a);
    }),
  );
}

async function main() {
  const [email, name, role = "admin"] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Kullanım: npm run user:add -- e-posta "Ad Soyad" [admin|agent]');
    process.exit(1);
  }
  const password = process.env.SZ_PASSWORD || (await ask("Şifre (en az 10 karakter): "));
  if (password.length < 10) {
    console.error("Şifre en az 10 karakter olmalı.");
    process.exit(1);
  }
  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const e = email.trim().toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, e));
  if (existing) {
    await db.update(schema.users).set({ name, role, passwordHash }).where(eq(schema.users.id, existing.id));
    console.log(`Güncellendi: ${e}`);
  } else {
    await db.insert(schema.users).values({ email: e, name, role, passwordHash });
    console.log(`Oluşturuldu: ${e}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
