import { NextRequest } from "next/server";

import { env } from "@/env";
import { ApiError } from "@/lib/errors";

export function requireApiKey(request: NextRequest) {
  const header = request.headers.get("authorization");
  const expected = `Bearer ${env.apiKey}`;

  if (!header || header !== expected) {
    throw new ApiError(401, "Missing or invalid API key");
  }
}

