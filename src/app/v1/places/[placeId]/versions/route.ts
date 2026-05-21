import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { listPlaceVersions } from "@/lib/places";

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
    return NextResponse.json(await listPlaceVersions(placeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

