import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";

import { DEFAULT_DEV_API_KEY, env } from "@/env";
import { ApiError } from "@/lib/errors";
import { requireApiKey, requireHealthApiKey, resetHealthApiKeyAttemptStateForTests } from "@/lib/auth";

const originalApiKey = env.apiKey;
const originalNodeEnv = process.env.NODE_ENV;
const originalRequireStrongApiKey = process.env.AIGO_REQUIRE_STRONG_API_KEY;

function requestWithAuthorization(value?: string) {
  return {
    headers: new Headers(value ? { authorization: value } : {})
  } as NextRequest;
}

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("requireApiKey", () => {
  afterEach(() => {
    env.apiKey = originalApiKey;
    resetHealthApiKeyAttemptStateForTests();
    setNodeEnv(originalNodeEnv);
    if (originalRequireStrongApiKey === undefined) {
      delete process.env.AIGO_REQUIRE_STRONG_API_KEY;
    } else {
      process.env.AIGO_REQUIRE_STRONG_API_KEY = originalRequireStrongApiKey;
    }
  });

  it("allows the default development key during local development", () => {
    setNodeEnv("development");
    delete process.env.AIGO_REQUIRE_STRONG_API_KEY;
    env.apiKey = DEFAULT_DEV_API_KEY;

    expect(() => requireApiKey(requestWithAuthorization(`Bearer ${DEFAULT_DEV_API_KEY}`))).not.toThrow();
  });

  it("rejects the default development key in production", () => {
    setNodeEnv("production");
    env.apiKey = DEFAULT_DEV_API_KEY;

    expect(() => requireApiKey(requestWithAuthorization(`Bearer ${DEFAULT_DEV_API_KEY}`))).toThrow(
      expect.objectContaining<Partial<ApiError>>({
        status: 500,
        message: "AIGO_API_KEY must be set to a non-default value before exposing the AiGo API."
      })
    );
  });

  it("can require a non-default key outside production", () => {
    setNodeEnv("development");
    process.env.AIGO_REQUIRE_STRONG_API_KEY = "true";
    env.apiKey = DEFAULT_DEV_API_KEY;

    expect(() => requireApiKey(requestWithAuthorization(`Bearer ${DEFAULT_DEV_API_KEY}`))).toThrow(
      expect.objectContaining<Partial<ApiError>>({
        status: 500
      })
    );
  });

  it("accepts a configured non-default key when strong key mode is enabled", () => {
    setNodeEnv("production");
    env.apiKey = "local-secret";

    expect(() => requireApiKey(requestWithAuthorization("Bearer local-secret"))).not.toThrow();
  });
});

describe("requireHealthApiKey", () => {
  afterEach(() => {
    env.apiKey = originalApiKey;
    resetHealthApiKeyAttemptStateForTests();
    setNodeEnv(originalNodeEnv);
    if (originalRequireStrongApiKey === undefined) {
      delete process.env.AIGO_REQUIRE_STRONG_API_KEY;
    } else {
      process.env.AIGO_REQUIRE_STRONG_API_KEY = originalRequireStrongApiKey;
    }
  });

  it("accepts the configured API key", () => {
    setNodeEnv("production");
    env.apiKey = "health-secret";

    expect(() => requireHealthApiKey(requestWithAuthorization("Bearer health-secret"))).not.toThrow();
  });

  it("blocks a client briefly after repeated invalid health API key attempts", () => {
    setNodeEnv("production");
    env.apiKey = "health-secret";
    const request = {
      headers: new Headers({
        authorization: "Bearer wrong",
        "x-forwarded-for": "203.0.113.10"
      })
    } as NextRequest;

    for (let index = 0; index < 5; index += 1) {
      expect(() => requireHealthApiKey(request, 1_000)).toThrow(
        expect.objectContaining<Partial<ApiError>>({
          status: 401
        })
      );
    }

    expect(() => requireHealthApiKey(request, 1_001)).toThrow(
      expect.objectContaining<Partial<ApiError>>({
        status: 429,
        message: "Too many invalid API key attempts"
      })
    );
  });
});
