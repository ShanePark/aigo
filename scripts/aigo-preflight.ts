import postgres from "postgres";

import { assertSafeApiKeyForRuntime, env, isDefaultDevApiKey } from "@/env";
import { missingDatabaseSchemaArtifacts } from "./aigo-preflight-schema";

const apiBaseUrl = normalizeBaseUrl(process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
const sql = postgres(env.databaseUrl, { max: 1, prepare: false });

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const results: CheckResult[] = [];

try {
  const apiKeyConfiguration = checkApiKeyConfiguration();
  results.push(apiKeyConfiguration);
  if (apiKeyConfiguration.ok) {
    results.push(await checkApiRejectsMissingKey());
    results.push(await checkApiAcceptsExpectedKey());
  }
  results.push(await checkDatabaseSchema());
} finally {
  await sql.end();
}

for (const result of results) {
  console.log(`${result.ok ? "[ok]" : "[fail]"} ${result.name}: ${result.detail}`);
}

if (results.some((result) => !result.ok)) {
  console.error(
    `AiGo preflight failed. Check AIGO_API_BASE_URL (${apiBaseUrl}), AIGO_API_KEY (${describeApiKey()}), and DATABASE_URL.`
  );
  process.exit(1);
}

console.log(`AiGo preflight passed for ${apiBaseUrl} with ${describeApiKey()}.`);

function checkApiKeyConfiguration(): CheckResult {
  try {
    assertSafeApiKeyForRuntime();
    return {
      name: "api key configuration",
      ok: true,
      detail: isDefaultDevApiKey() ? "using the local development API key" : "configured API key is non-default"
    };
  } catch (error) {
    return {
      name: "api key configuration",
      ok: false,
      detail: errorMessage(error)
    };
  }
}

async function checkApiRejectsMissingKey(): Promise<CheckResult> {
  try {
    const response = await callDuplicateCheck();
    return {
      name: "api running",
      ok: response.status === 401,
      detail:
        response.status === 401
          ? "local API responded and rejected a missing Authorization header"
          : `expected 401 without Authorization, received ${response.status} ${await response.text()}`
    };
  } catch (error) {
    return {
      name: "api running",
      ok: false,
      detail: errorMessage(error)
    };
  }
}

async function checkApiAcceptsExpectedKey(): Promise<CheckResult> {
  try {
    const response = await callDuplicateCheck(env.apiKey);
    const body = await response.text();

    if (!response.ok) {
      return {
        name: "api key accepted",
        ok: false,
        detail: `expected 2xx with configured key, received ${response.status} ${body}`
      };
    }

    const parsed = JSON.parse(body) as { items?: unknown };
    const itemCount = Array.isArray(parsed.items) ? parsed.items.length : 0;

    return {
      name: "api key accepted",
      ok: Array.isArray(parsed.items),
      detail: Array.isArray(parsed.items)
        ? `authorized duplicate check succeeded with ${itemCount} candidate(s)`
        : "authorized response did not include an items array"
    };
  } catch (error) {
    return {
      name: "api key accepted",
      ok: false,
      detail: errorMessage(error)
    };
  }
}

async function checkDatabaseSchema(): Promise<CheckResult> {
  try {
    const [columnRows, extensionRows, indexRows, constraintRows, triggerRows, functionRows, countRows] = await Promise.all([
      sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
      `,
      sql<{ extname: string }[]>`
        select extname
        from pg_extension
        where extname in ('postgis', 'pg_trgm', 'pgcrypto')
      `,
      sql<{ tablename: string; indexname: string }[]>`
        select tablename, indexname
        from pg_indexes
        where schemaname = 'public'
      `,
      sql<{ table_name: string; constraint_name: string }[]>`
        select table_name, constraint_name
        from information_schema.table_constraints
        where table_schema = 'public'
      `,
      sql<{ table_name: string; trigger_name: string }[]>`
        select event_object_table as table_name, trigger_name
        from information_schema.triggers
        where trigger_schema = 'public'
      `,
      sql<{ proname: string }[]>`
        select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      `,
      sql<{ count: string }[]>`
        select count(*)::text as count
        from places
      `
    ]);

    const missing = missingDatabaseSchemaArtifacts({
      columns: columnRows.map((row) => ({ tableName: row.table_name, columnName: row.column_name })),
      constraints: constraintRows.map((row) => ({ tableName: row.table_name, name: row.constraint_name })),
      extensions: extensionRows.map((row) => row.extname),
      functions: functionRows.map((row) => row.proname),
      indexes: indexRows.map((row) => ({ tableName: row.tablename, name: row.indexname })),
      triggers: triggerRows.map((row) => ({ tableName: row.table_name, name: row.trigger_name }))
    });

    const placeCount = countRows[0]?.count ?? "unknown";
    return {
      name: "db schema ready",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `required tables, columns, custom schema artifacts, and places are readable (${placeCount} row(s))`
          : `missing ${missing.join(", ")}`
    };
  } catch (error) {
    return {
      name: "db schema ready",
      ok: false,
      detail: errorMessage(error)
    };
  }
}

async function callDuplicateCheck(apiKey?: string) {
  const response = await fetch(`${apiBaseUrl}/v1/places/duplicates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      name: "AiGo preflight sentinel",
      lat: 0,
      lng: 0,
      radiusMeters: 1,
      limit: 1
    }),
    signal: AbortSignal.timeout(5_000)
  });

  return response;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function describeApiKey() {
  return isDefaultDevApiKey() ? "the default development API key" : "the configured AIGO_API_KEY";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
