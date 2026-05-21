import { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";

export async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

