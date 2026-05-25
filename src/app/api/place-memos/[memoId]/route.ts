import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { deletePlacePublicMemo, updatePlacePublicMemo, updatePlacePublicMemoSchema } from "@/lib/place-public-memos";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    memoId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { memoId: rawMemoId } = await context.params;
    const memoId = requireUuidParam(rawMemoId, "memoId");
    const user = await requireCurrentUser(request);
    const input = updatePlacePublicMemoSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlacePublicMemo(memoId, user.id, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { memoId: rawMemoId } = await context.params;
    const memoId = requireUuidParam(rawMemoId, "memoId");
    const user = await requireCurrentUser(request);
    return NextResponse.json(await deletePlacePublicMemo(memoId, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
