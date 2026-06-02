import { DEFAULT_DEV_API_KEY } from "@/env";
import type { SearchPlacesInput, searchPlacesSchema } from "@/lib/schemas";
import type { z } from "zod";

export type AigoSearchRequest = z.input<typeof searchPlacesSchema>;

export type AigoSearchItem = {
  id?: unknown;
  placeId?: unknown;
  name?: unknown;
  primaryCategory?: unknown;
  [key: string]: unknown;
};

export type NormalizedAigoSearchResponse<TItem = AigoSearchItem> = {
  items: TItem[];
  meta: Record<string, unknown> | null;
};

export type AigoSearchOptions = {
  apiBaseUrl?: string;
  apiKey?: string;
  retryDelayMs?: number;
  retries?: number;
  timeoutMs?: number;
};

export type ExactNameSearchOptions = AigoSearchOptions & {
  includeStatuses?: SearchPlacesInput["includeStatuses"];
  limit?: number;
};

export type AigoJsonReadOptions = AigoSearchOptions & {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
};

export type AigoReadOnlyReadinessOptions = AigoSearchOptions & {
  expectedExactNamePlaceId?: string;
  exactName?: string;
  log?: (message: string) => void;
};

export function readSearchItems<TItem = AigoSearchItem>(response: unknown): TItem[] {
  if (!isRecord(response)) {
    throw new Error("AiGo search response must be an object with a top-level items array.");
  }

  if ("items" in response) {
    if (!Array.isArray(response.items)) {
      throw new Error("AiGo search response included top-level items, but it was not an array.");
    }
    return response.items as TItem[];
  }

  if (Array.isArray(response.results)) {
    return response.results as TItem[];
  }

  throw new Error("AiGo search response did not include top-level items array; legacy results array was also absent.");
}

export function normalizeSearchResponse<TItem = AigoSearchItem>(response: unknown): NormalizedAigoSearchResponse<TItem> {
  if (!isRecord(response)) {
    throw new Error("AiGo search response must be an object.");
  }

  return {
    items: readSearchItems<TItem>(response),
    meta: isRecord(response.meta) ? response.meta : null
  };
}

export async function searchPlacesReadOnly<TItem = AigoSearchItem>(
  request: AigoSearchRequest,
  options: AigoSearchOptions = {}
): Promise<NormalizedAigoSearchResponse<TItem>> {
  const response = await readAigoJsonReadOnly("/v1/places/search", {
    ...options,
    method: "POST",
    body: request
  });

  return normalizeSearchResponse<TItem>(response);
}

export async function readAigoJsonReadOnly<TResponse = Record<string, unknown>>(
  path: string,
  options: AigoJsonReadOptions = {}
): Promise<TResponse> {
  const { apiBaseUrl, apiKey } = resolveAigoReadOnlyConfig(options);
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const method = resolveHttpMethod(options);
  const maxAttempts = retries + 1;
  let lastFailure: AigoReadFailure | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const attemptNumber = attempt + 1;
    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof fetchAigoJsonResponse>> | null = null;
    let caughtRequestFailure = false;

    try {
      result = await fetchAigoJsonResponse(apiBaseUrl, path, apiKey, options, timeoutMs);
    } catch (error) {
      caughtRequestFailure = true;
      lastFailure = {
        kind: "network",
        error,
        durationMs: Date.now() - startedAt,
        method,
        path,
        attempt: attemptNumber,
        timeoutMs
      };
    }

    if (!caughtRequestFailure && result) {
      const durationMs = Date.now() - startedAt;
      if (result.response.ok) {
        return (result.text ? JSON.parse(result.text) : {}) as TResponse;
      }

      lastFailure = {
        kind: "http",
        response: result.response,
        text: result.text,
        durationMs,
        method,
        path,
        attempt: attemptNumber,
        timeoutMs
      };
    }

    if (!lastFailure || attempt >= retries || !isTransientAigoReadFailure(lastFailure)) break;
    await delay((options.retryDelayMs ?? 150) * (attempt + 1));
  }

  if (lastFailure) {
    throw new Error(formatAigoReadFailure(lastFailure, maxAttempts));
  }

  throw new Error(`AiGo ${path} failed before receiving a response.`);
}

export async function warmSearchRouteReadOnly(options: AigoSearchOptions = {}) {
  await searchPlacesReadOnly(
    {
      projection: "compact",
      limit: 1,
      offset: 0
    },
    options
  );
}

export async function checkAigoReadOnlyApiReadiness(options: AigoReadOnlyReadinessOptions = {}) {
  const { apiBaseUrl } = resolveAigoReadOnlyConfig(options);
  options.log?.(`AiGo read-only API base URL: ${apiBaseUrl}`);

  await warmSearchRouteReadOnly(options);

  if (!options.exactName) return { apiBaseUrl, exactNameMatched: null };

  const search = await exactNameSearchReadOnly(options.exactName, options);
  const expectedId = options.expectedExactNamePlaceId;
  if (expectedId && !search.items.some((item) => itemId(item) === expectedId)) {
    throw new Error(
      `AiGo exact-name healthcheck failed for ${JSON.stringify(options.exactName)} at ${apiBaseUrl}: expected place ${expectedId}, got ${search.items
        .map(itemId)
        .filter(Boolean)
        .join(", ") || "no ids"}.`
    );
  }

  return { apiBaseUrl, exactNameMatched: search.items.length > 0 };
}

export async function exactNameSearchReadOnly<TItem = AigoSearchItem>(
  name: string,
  options: ExactNameSearchOptions = {}
): Promise<NormalizedAigoSearchResponse<TItem>> {
  const { includeStatuses = ["active", "temporarily_closed"], limit = 5, ...requestOptions } = options;
  return searchPlacesReadOnly<TItem>(
    {
      query: name,
      matchMode: "exactName",
      includeStatuses,
      projection: "compact",
      limit,
      offset: 0
    },
    requestOptions
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemId(item: AigoSearchItem) {
  const id = item.id ?? item.placeId;
  return typeof id === "string" ? id : null;
}

function resolveAigoReadOnlyConfig(options: AigoSearchOptions) {
  return {
    apiBaseUrl: normalizeBaseUrl(options.apiBaseUrl ?? process.env.AIGO_API_BASE_URL ?? "http://localhost:3000"),
    apiKey: options.apiKey ?? process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

type AigoHttpFailure = {
  kind: "http";
  response: Response;
  text: string;
  durationMs: number;
  method: string;
  path: string;
  attempt: number;
  timeoutMs: number;
};

type AigoNetworkFailure = {
  kind: "network";
  error: unknown;
  durationMs: number;
  method: string;
  path: string;
  attempt: number;
  timeoutMs: number;
};

type AigoReadFailure = AigoHttpFailure | AigoNetworkFailure;

async function fetchAigoJsonResponse(apiBaseUrl: string, path: string, apiKey: string, options: AigoJsonReadOptions, timeoutMs: number) {
  const body = options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  const response = await fetch(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    method: resolveHttpMethod(options),
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...options.headers
    },
    body,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  return { response, text };
}

function resolveHttpMethod(options: AigoJsonReadOptions) {
  return (options.method ?? (options.body === undefined ? "GET" : "POST")).toUpperCase();
}

function isTransientAigoReadFailure(failure: AigoReadFailure) {
  if (failure.kind === "network") return true;
  return isTransientAigoRouteFailure(failure);
}

function isTransientAigoRouteFailure(failure: AigoHttpFailure) {
  return isTransientAigoRouteResponse(failure.response.status, failure.response.headers.get("content-type"), failure.text);
}

export function isTransientAigoRouteResponse(status: number, contentType: string | null | undefined, text: string) {
  if ([500, 502, 503, 504].includes(status)) return true;
  if (status !== 404) return false;
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const body = text.toLowerCase();
  return normalizedContentType.includes("text/html") || body.includes("<!doctype html") || body.includes("this page could not be found");
}

function formatAigoReadFailure(failure: AigoReadFailure, maxAttempts: number) {
  const route = `${failure.method} ${failure.path}`;
  const timing = `attempt=${failure.attempt}/${maxAttempts}, timeoutMs=${failure.timeoutMs}, durationMs=${failure.durationMs}`;

  if (failure.kind === "http") {
    const status = `${failure.response.status} ${failure.response.statusText}`.trim();
    return `AiGo ${route} failed (${timing}, status=${status}): ${failure.text.slice(0, 500)}`;
  }

  return `AiGo ${route} failed (${timing}, status=no-response): ${formatUnknownError(failure.error)}`;
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
