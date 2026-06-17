import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { compactSearchPlacesResponse, searchPlaces } from "@/lib/places";
import { searchPlacesSchema } from "@/lib/schemas";
import { recordVisitEventLater } from "@/lib/visit-events";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed",
      details: {
        allowedMethods: ["POST"],
        message: "Use POST /v1/places/search with a JSON search payload."
      }
    },
    {
      status: 405,
      headers: {
        Allow: "POST"
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = searchPlacesSchema.parse(await readJson(request));
    const result = await searchPlaces(input);
    recordVisitEventLater({
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
