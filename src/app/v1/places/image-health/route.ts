import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { listPlaceImageHealth } from "@/lib/places";
import { placeImageHealthQuerySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = placeImageHealthQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(await listPlaceImageHealth(input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
