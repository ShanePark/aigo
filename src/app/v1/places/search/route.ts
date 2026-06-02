import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { compactSearchPlacesResponse, searchPlaces } from "@/lib/places";
import { searchPlacesSchema } from "@/lib/schemas";
import { recordVisitEvent } from "@/lib/visit-events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = searchPlacesSchema.parse(await readJson(request));
    const result = await searchPlaces(input);
    await recordVisitEvent({
      eventSource: "v1",
      eventType: "place_search",
      request,
      searchInput: input,
      searchResultCount: result.items.length,
      searchResultTotal: result.meta.total
    });
    return NextResponse.json(input.projection === "compact" ? compactSearchPlacesResponse(result) : result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
