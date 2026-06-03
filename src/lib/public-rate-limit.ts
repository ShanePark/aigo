import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";

const PUBLIC_READ_WINDOW_MS = 60_000;
const DEFAULT_PUBLIC_READ_LIMIT = 60;
const DEFAULT_PUBLIC_SEARCH_LIMIT = 30;

type PublicRateLimitState = {
  count: number;
  resetAt: number;
};

type PublicRateLimitInput = {
  bucket: "place-detail" | "place-search" | "place-view";
  headers: Pick<Headers, "get">;
  limit?: number;
  now?: number;
};

export type PublicRateLimitResult =
  | {
      allowed: true;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      limit: number;
      retryAfterSeconds: number;
      resetAt: number;
    };

declare global {
  var aigoPublicReadRateLimit: Map<string, PublicRateLimitState> | undefined;
}

const publicReadRateLimit = globalThis.aigoPublicReadRateLimit ?? new Map<string, PublicRateLimitState>();

if (process.env.NODE_ENV !== "production") {
  globalThis.aigoPublicReadRateLimit = publicReadRateLimit;
}

export function assertPublicReadRateLimit(request: NextRequest, options: Omit<PublicRateLimitInput, "headers">) {
  const result = checkPublicReadRateLimit({ ...options, headers: request.headers });
  if (!result.allowed) {
    throw new ApiError(429, "Too many public place requests", {
      retryAfterSeconds: result.retryAfterSeconds
    });
  }
  return result;
}

export function checkPublicReadRateLimit(input: PublicRateLimitInput): PublicRateLimitResult {
  const now = input.now ?? Date.now();
  cleanupPublicReadRateLimit(now);

  const limit = input.limit ?? publicReadLimitForBucket(input.bucket);
  const clientKey = publicReadClientKey(input.headers);
  const key = `${input.bucket}:${clientKey}`;
  const state = publicReadRateLimit.get(key);

  if (!state || state.resetAt <= now) {
    const resetAt = now + PUBLIC_READ_WINDOW_MS;
    publicReadRateLimit.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  if (state.count >= limit) {
    return {
      allowed: false,
      limit,
      resetAt: state.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000))
    };
  }

  state.count += 1;
  return { allowed: true, limit, remaining: limit - state.count, resetAt: state.resetAt };
}

export function resetPublicReadRateLimitForTests() {
  publicReadRateLimit.clear();
}

function publicReadLimitForBucket(bucket: PublicRateLimitInput["bucket"]) {
  const envValue = bucket === "place-search" ? process.env.AIGO_PUBLIC_SEARCH_RATE_LIMIT : process.env.AIGO_PUBLIC_READ_RATE_LIMIT;
  const parsed = Number.parseInt(envValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return bucket === "place-search" ? DEFAULT_PUBLIC_SEARCH_LIMIT : DEFAULT_PUBLIC_READ_LIMIT;
}

function publicReadClientKey(headers: Pick<Headers, "get">) {
  const ip =
    headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const userAgent = headers.get("user-agent")?.trim().slice(0, 160) || "unknown";
  return `${ip}:${userAgent}`;
}

function cleanupPublicReadRateLimit(now: number) {
  for (const [key, state] of publicReadRateLimit) {
    if (state.resetAt <= now) {
      publicReadRateLimit.delete(key);
    }
  }
}
