import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { deletePlaceVisit, updatePlaceVisit, updatePlaceVisitSchema } from "@/lib/place-visits";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    visitId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { visitId: rawVisitId } = await context.params;
    const visitId = requireUuidParam(rawVisitId, "visitId");
    const user = await requireCurrentUser(request);
    const input = updatePlaceVisitSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlaceVisit(visitId, user.id, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { visitId: rawVisitId } = await context.params;
    const visitId = requireUuidParam(rawVisitId, "visitId");
    const user = await requireCurrentUser(request);
    return NextResponse.json(await deletePlaceVisit(visitId, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
