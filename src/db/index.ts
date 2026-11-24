import path from "node:path";
import * as schema from "./schema";

// Production: DATABASE_URL points to Supabase Postgres.
// Local development without DATABASE_URL: an embedded Postgres (PGlite) stored in ./.data.

type Db = ReturnType<typeof import("drizzle-orm/postgres-js").drizzle<typeof schema>>;

const g = globalThis as unknown as { __szDb?: Promise<Db> };
const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    // prepare:false keeps it compatible with Supabase's transaction pooler.
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzle(client, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!g.__szDb) g.__szDb = connect();
  return g.__szDb;
}

export { schema };
