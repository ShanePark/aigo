import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { recordPlaceView } from "@/lib/user-place-views";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const user = await requireCurrentUser(request);
    return NextResponse.json(await recordPlaceView(placeId, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
