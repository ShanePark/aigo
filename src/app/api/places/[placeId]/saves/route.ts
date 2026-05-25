import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { getPlaceSaveState, updatePlaceSaveSchema, updatePlaceSaveState } from "@/lib/user-place-saves";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const user = await requireCurrentUser(request);
    return NextResponse.json(await getPlaceSaveState(placeId, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const user = await requireCurrentUser(request);
    const input = updatePlaceSaveSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlaceSaveState(placeId, user.id, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
