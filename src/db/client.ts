import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

declare global {
  var aigoPostgresClient: postgres.Sql | undefined;
}

const client =
  globalThis.aigoPostgresClient ??
  postgres(env.databaseUrl, {
    max: 10,
    prepare: false
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.aigoPostgresClient = client;
}

export const pg = client;
export const db = drizzle(client, { schema });
