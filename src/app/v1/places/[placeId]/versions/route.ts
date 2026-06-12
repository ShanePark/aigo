import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { listPlaceVersions } from "@/lib/places";
import { requireUuidParam } from "@/lib/route-params";

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
    return NextResponse.json(await listPlaceVersions(placeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
