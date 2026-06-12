import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { deletePlace, getPlaceDetail, updatePlace } from "@/lib/places";
import { requireUuidParam } from "@/lib/route-params";
import { deletePlaceSchema, updatePlaceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    return NextResponse.json(await getPlaceDetail(placeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const input = updatePlaceSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlace(placeId, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const input = deletePlaceSchema.parse(await readJson(request));
    return NextResponse.json(await deletePlace(placeId, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
