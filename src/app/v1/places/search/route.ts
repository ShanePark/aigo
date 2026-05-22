import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { compactSearchPlacesResponse, searchPlaces } from "@/lib/places";
import { searchPlacesSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = searchPlacesSchema.parse(await readJson(request));
    const result = await searchPlaces(input);
    return NextResponse.json(input.projection === "compact" ? compactSearchPlacesResponse(result) : result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
