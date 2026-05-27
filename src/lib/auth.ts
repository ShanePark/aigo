import { NextRequest } from "next/server";

import { assertSafeApiKeyForRuntime, env } from "@/env";
import { ApiError } from "@/lib/errors";

const HEALTH_INVALID_ATTEMPT_WINDOW_MS = 60_000;
const HEALTH_INVALID_ATTEMPT_BLOCK_MS = 5 * 60_000;
const HEALTH_INVALID_ATTEMPT_LIMIT = 5;

type HealthInvalidAttemptState = {
  blockedUntil: number;
  count: number;
  firstAttemptAt: number;
};

declare global {
  var aigoHealthInvalidApiKeyAttempts: Map<string, HealthInvalidAttemptState> | undefined;
}

const healthInvalidApiKeyAttempts = globalThis.aigoHealthInvalidApiKeyAttempts ?? new Map<string, HealthInvalidAttemptState>();

if (process.env.NODE_ENV !== "production") {
  globalThis.aigoHealthInvalidApiKeyAttempts = healthInvalidApiKeyAttempts;
}

export function requireApiKey(request: NextRequest) {
  try {
    assertSafeApiKeyForRuntime();
  } catch (error) {
    throw new ApiError(500, error instanceof Error ? error.message : "API key configuration is unsafe");
  }

  const header = request.headers.get("authorization");
  const expected = `Bearer ${env.apiKey}`;

  if (!header || header !== expected) {
    throw new ApiError(401, "Missing or invalid API key");
  }
}

export function requireHealthApiKey(request: NextRequest, now = Date.now()) {
  try {
    assertSafeApiKeyForRuntime();
  } catch (error) {
    throw new ApiError(500, error instanceof Error ? error.message : "API key configuration is unsafe");
  }

  const header = request.headers.get("authorization");
  const expected = `Bearer ${env.apiKey}`;
  const clientKey = healthClientKey(request);

  if (header === expected) {
    healthInvalidApiKeyAttempts.delete(clientKey);
    return;
  }

  const state = healthInvalidApiKeyAttempts.get(clientKey);
  if (state && state.blockedUntil > now) {
    throw new ApiError(429, "Too many invalid API key attempts", {
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000)
    });
  }

  const nextState =
    state && now - state.firstAttemptAt <= HEALTH_INVALID_ATTEMPT_WINDOW_MS
      ? { ...state, count: state.count + 1, blockedUntil: 0 }
      : { count: 1, firstAttemptAt: now, blockedUntil: 0 };

  if (nextState.count >= HEALTH_INVALID_ATTEMPT_LIMIT) {
    nextState.blockedUntil = now + HEALTH_INVALID_ATTEMPT_BLOCK_MS;
  }

  healthInvalidApiKeyAttempts.set(clientKey, nextState);
  cleanupHealthInvalidAttempts(now);

  throw new ApiError(401, "Missing or invalid API key");
}

export function resetHealthApiKeyAttemptStateForTests() {
  healthInvalidApiKeyAttempts.clear();
}

function healthClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

function cleanupHealthInvalidAttempts(now: number) {
  for (const [clientKey, state] of healthInvalidApiKeyAttempts) {
    const windowExpired = now - state.firstAttemptAt > HEALTH_INVALID_ATTEMPT_WINDOW_MS;
    const blockExpired = state.blockedUntil > 0 && state.blockedUntil <= now;
    if (windowExpired && (state.blockedUntil === 0 || blockExpired)) {
      healthInvalidApiKeyAttempts.delete(clientKey);
    }
  }
}
