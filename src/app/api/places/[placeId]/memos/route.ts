import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken, requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { createPlacePublicMemoSchema, listPlacePublicMemos, upsertPlacePublicMemo } from "@/lib/place-public-memos";
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
    const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
    return NextResponse.json(await listPlacePublicMemos(placeId, user?.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const user = await requireCurrentUser(request);
    const input = createPlacePublicMemoSchema.parse(await readJson(request));
    return NextResponse.json(await upsertPlacePublicMemo(placeId, user.id, input), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
