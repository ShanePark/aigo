import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { searchPlaces } from "@/lib/places";
import { assertPublicReadRateLimit } from "@/lib/public-rate-limit";
import { searchPlacesSchema } from "@/lib/schemas";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { recordVisitEventLater } from "@/lib/visit-events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertPublicReadRateLimit(request, { bucket: "place-search" });
    const input = searchPlacesSchema.parse(await readJson(request));
    const result = await searchPlaces(input);
    void currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value)
      .then((user) => {
        recordVisitEventLater({
          eventType: "place_search",
          request,
          searchInput: input,
          searchResultCount: result.items.length,
          searchResultTotal: result.meta.total,
          user
        });
      })
      .catch((error) => {
        console.warn("Failed to load visit event user", error);
      });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
