import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { retireDuplicatePlace } from "@/lib/places";
import { retireDuplicatePlaceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId } = await context.params;
    const input = retireDuplicatePlaceSchema.parse(await readJson(request));
    return NextResponse.json(await retireDuplicatePlace(placeId, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
