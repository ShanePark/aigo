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
  timeoutMs?: number;
};

export type ExactNameSearchOptions = AigoSearchOptions & {
  limit?: number;
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
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
  const apiKey = options.apiKey ?? process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY;
  const response = await fetch(`${apiBaseUrl}/v1/places/search`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`AiGo search failed with ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  return normalizeSearchResponse<TItem>(text ? JSON.parse(text) : {});
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
