// Creates or updates a CRM user.
//   npm run user:add -- ad@sezarsigorta.com "Ad Soyad" [admin|agent]
// The password is asked interactively (not stored in shell history).
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createInterface } from "node:readline";
import { getDb, schema } from "../src/db";

/** Reads a password with nothing echoed (raw terminal mode; one "•" per character). */
async function ask(q: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    // Piped input (not a terminal): read one line.
    const rl = createInterface({ input: stdin });
    return new Promise((res) => rl.once("line", (l) => (rl.close(), res(l))));
  }
  process.stdout.write(q);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise<string>((res) => {
    let value = "";
    const done = (ok: boolean) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      if (!ok) process.exit(130);
      res(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(true);
        if (ch === "\u0003") return done(false); // Ctrl-C
        if (ch === "\u007f" || ch === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write("•");
        }
      }
    };
    stdin.on("data", onData);
  });
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
  if (!process.env.SZ_PASSWORD && (await ask("Şifre tekrar: ")) !== password) {
    console.error("Şifreler aynı değil, hiçbir şey değiştirilmedi.");
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
