import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { searchPlaces } from "@/lib/places";
import { searchPlacesSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = searchPlacesSchema.parse(await readJson(request));
    return NextResponse.json(await searchPlaces(input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
