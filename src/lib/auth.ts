import { NextRequest } from "next/server";

import { assertSafeApiKeyForRuntime, env } from "@/env";
import { ApiError } from "@/lib/errors";

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
