import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { createPlace } from "@/lib/places";
import { createPlaceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = createPlaceSchema.parse(await readJson(request));
    return NextResponse.json(await createPlace(input), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

