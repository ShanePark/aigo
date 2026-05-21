import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://aigo:aigo@localhost:5431/aigo";
const migrationDir = path.join(process.cwd(), "drizzle");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await sql`
    create table if not exists _aigo_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const existing = await sql`select filename from _aigo_migrations where filename = ${file}`;
    if (existing.length > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const migration = await readFile(path.join(migrationDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
      await tx`insert into _aigo_migrations (filename) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
} finally {
  await sql.end();
}

