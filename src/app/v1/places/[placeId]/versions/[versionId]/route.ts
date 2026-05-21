import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { getPlaceVersion } from "@/lib/places";

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
    const { placeId, versionId } = await context.params;
    return NextResponse.json(await getPlaceVersion(placeId, versionId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

