import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { getPlaceDetail, updatePlace } from "@/lib/places";
import { updatePlaceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId } = await context.params;
    return NextResponse.json(await getPlaceDetail(placeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId } = await context.params;
    const input = updatePlaceSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlace(placeId, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

