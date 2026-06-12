import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { getPlaceVersion } from "@/lib/places";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    placeId: string;
    versionId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireApiKey(request);
    const { placeId: rawPlaceId, versionId: rawVersionId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const versionId = requireUuidParam(rawVersionId, "versionId");
    return NextResponse.json(await getPlaceVersion(placeId, versionId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
