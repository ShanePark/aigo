import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type SmokeRetireDuplicateRouteArgs = {
  apiBaseUrl: string;
  apiKey?: string;
  timeoutMs: number;
};

type SmokeResult = {
  apiBaseUrl: string;
  route: string;
  status: number;
  ok: boolean;
  message: string;
};

const PRODUCTION_AIGO_API_BASE_URL = "https://aigo.o-r.kr";
const SENTINEL_RETIRE_PLACE_ID = "00000000-0000-4000-8000-000000000001";
const SENTINEL_CANONICAL_PLACE_ID = "00000000-0000-4000-8000-000000000002";

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await smokeRetireDuplicateRoute(args);
    console.log(result.message);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): SmokeRetireDuplicateRouteArgs {
  const args: SmokeRetireDuplicateRouteArgs = {
    apiBaseUrl: PRODUCTION_AIGO_API_BASE_URL,
    timeoutMs: 10_000
  };

  for (const arg of argv) {
    if (arg.startsWith("--api-base-url=")) {
      args.apiBaseUrl = normalizeBaseUrl(arg.slice("--api-base-url=".length));
      continue;
    }
    if (arg.startsWith("--api-key=")) {
      args.apiKey = optionalString(arg.slice("--api-key=".length));
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = positiveInteger(arg.slice("--timeout-ms=".length), "timeout-ms");
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export async function smokeRetireDuplicateRoute(args: SmokeRetireDuplicateRouteArgs): Promise<SmokeResult> {
  const apiBaseUrl = normalizeBaseUrl(args.apiBaseUrl);
  const apiKey = resolveApiKey(args.apiKey);
  const route = `/v1/places/${SENTINEL_RETIRE_PLACE_ID}/retire-duplicate`;
  const response = await fetch(`${apiBaseUrl}${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      confirmation: "retire_duplicate",
      canonicalPlaceId: SENTINEL_CANONICAL_PLACE_ID,
      sources: [{ sourceType: "agent_observation", externalId: "retire-duplicate-route-smoke" }],
      changeSummary: "retire-duplicate route smoke check with nonexistent sentinel ids"
    }),
    signal: AbortSignal.timeout(args.timeoutMs)
  });
  const text = await response.text();

  return evaluateSmokeResponse(apiBaseUrl, route, response.status, response.headers.get("content-type"), text);
}

export function evaluateSmokeResponse(
  apiBaseUrl: string,
  route: string,
  status: number,
  contentType: string | null | undefined,
  text: string
): SmokeResult {
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const trimmedText = text.trim();
  if (status === 404 && normalizedContentType.includes("application/json")) {
    return {
      apiBaseUrl,
      route,
      status,
      ok: true,
      message: `Retire duplicate route smoke passed at ${apiBaseUrl}: JSON 404 for nonexistent sentinel id.`
    };
  }

  if (status === 404 && (normalizedContentType.includes("text/html") || trimmedText.toLowerCase().includes("<!doctype html"))) {
    throw new Error(`Retire duplicate route is not deployed at ${apiBaseUrl}${route}: received HTML 404.`);
  }

  throw new Error(
    `Retire duplicate route smoke failed at ${apiBaseUrl}${route}: status=${status}, contentType=${contentType ?? "unknown"}, body=${trimmedText.slice(0, 300)}`
  );
}

function resolveApiKey(explicitApiKey: string | undefined) {
  const envApiKey = explicitApiKey ?? process.env.AIGO_API_KEY ?? readEnvFileApiKey();
  if (!envApiKey || envApiKey === "change-me") {
    throw new Error("AIGO_API_KEY must be set to a non-default production key before retire-duplicate route smoke checks.");
  }
  return envApiKey;
}

function readEnvFileApiKey() {
  try {
    const env = readFileSync(".env", "utf8");
    const match = env.match(/^AIGO_API_KEY=(.*)$/m);
    return match ? match[1]?.trim().replace(/^['"]|['"]$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function positiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function isMain() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}
