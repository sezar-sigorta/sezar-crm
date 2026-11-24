// Applies the SQL migrations in ./drizzle to DATABASE_URL (Supabase).
//   DATABASE_URL=... npm run db:migrate
// Locally (no DATABASE_URL) the embedded database migrates itself on start.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL tanımlı değil.");
    process.exit(1);
  }
  const client = postgres(url, { max: 1, prepare: false });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("Migration tamam.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
