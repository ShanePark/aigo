import postgres from "postgres";

import { assertSafeApiKeyForRuntime, env, isDefaultDevApiKey } from "@/env";

const apiBaseUrl = normalizeBaseUrl(process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
const sql = postgres(env.databaseUrl, { max: 1, prepare: false });

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const requiredSchema: Record<string, string[]> = {
  places: [
    "id",
    "name",
    "geo",
    "official_url",
    "external_refs",
    "opening_hours",
    "reservation_required",
    "walk_in_available",
    "session_based",
    "same_day_availability_known",
    "parking_friction_level"
  ],
  place_sources: ["id", "place_id", "source_type", "url", "external_id", "checked_at"],
  place_images: ["id", "place_id", "url", "source_url", "review_status", "is_primary"],
  place_related_places: ["id", "place_id", "related_place_id", "relation_type", "evidence"],
  place_versions: ["id", "place_id", "version_number", "snapshot", "sources"]
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
    const [columnRows, extensionRows, countRows] = await Promise.all([
      sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
      `,
      sql<{ exists: boolean }[]>`
        select exists(select 1 from pg_extension where extname = 'postgis')
      `,
      sql<{ count: string }[]>`
        select count(*)::text as count
        from places
      `
    ]);

    const availableColumns = new Map<string, Set<string>>();
    for (const row of columnRows) {
      const tableColumns = availableColumns.get(row.table_name) ?? new Set<string>();
      tableColumns.add(row.column_name);
      availableColumns.set(row.table_name, tableColumns);
    }

    const missing = Object.entries(requiredSchema).flatMap(([table, columns]) => {
      const tableColumns = availableColumns.get(table);
      if (!tableColumns) {
        return [`${table}.*`];
      }

      return columns.filter((column) => !tableColumns.has(column)).map((column) => `${table}.${column}`);
    });

    const hasPostgis = extensionRows[0]?.exists === true;
    if (!hasPostgis) {
      missing.push("extension.postgis");
    }

    const placeCount = countRows[0]?.count ?? "unknown";
    return {
      name: "db schema ready",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `required tables/columns are present and places is readable (${placeCount} row(s))`
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
