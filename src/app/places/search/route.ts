import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { searchPlaces } from "@/lib/places";
import { searchPlacesSchema } from "@/lib/schemas";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { recordVisitEvent } from "@/lib/visit-events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = searchPlacesSchema.parse(await readJson(request));
    const result = await searchPlaces(input);
    const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
    await recordVisitEvent({
      eventType: "place_search",
      request,
      searchInput: input,
      searchResultCount: result.items.length,
      searchResultTotal: result.meta.total,
      user
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
