import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";

import { DEFAULT_DEV_API_KEY, env } from "@/env";
import { ApiError } from "@/lib/errors";
import { requireApiKey } from "@/lib/auth";

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
