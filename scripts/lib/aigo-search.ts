import { DEFAULT_DEV_API_KEY } from "@/env";
import type { searchPlacesSchema } from "@/lib/schemas";
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
  limit?: number;
};

export type AigoJsonReadOptions = AigoSearchOptions & {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
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
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
  const apiKey = options.apiKey ?? process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY;
  const retries = options.retries ?? 2;
  let lastFailure: AigoHttpFailure | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await fetchAigoJsonResponse(apiBaseUrl, path, apiKey, options, options.timeoutMs ?? 10_000);
    if (result.response.ok) {
      return (result.text ? JSON.parse(result.text) : {}) as TResponse;
    }

    lastFailure = result;
    if (attempt >= retries || !isTransientAigoRouteFailure(result)) break;
    await delay((options.retryDelayMs ?? 150) * (attempt + 1));
  }

  if (lastFailure) {
    throw new Error(`AiGo ${path} failed with ${lastFailure.response.status} ${lastFailure.response.statusText}: ${lastFailure.text.slice(0, 500)}`);
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

export async function exactNameSearchReadOnly<TItem = AigoSearchItem>(
  name: string,
  options: ExactNameSearchOptions = {}
): Promise<NormalizedAigoSearchResponse<TItem>> {
  const { limit = 5, ...requestOptions } = options;
  return searchPlacesReadOnly<TItem>(
    {
      query: name,
      matchMode: "exactName",
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

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

type AigoHttpFailure = {
  response: Response;
  text: string;
};

async function fetchAigoJsonResponse(apiBaseUrl: string, path: string, apiKey: string, options: AigoJsonReadOptions, timeoutMs: number) {
  const body = options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  const response = await fetch(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    method: options.method ?? (body ? "POST" : "GET"),
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

function isTransientAigoRouteFailure(failure: AigoHttpFailure) {
  if ([500, 502, 503, 504].includes(failure.response.status)) return true;
  if (failure.response.status !== 404) return false;
  const contentType = failure.response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = failure.text.toLowerCase();
  return contentType.includes("text/html") || body.includes("<!doctype html") || body.includes("this page could not be found");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
