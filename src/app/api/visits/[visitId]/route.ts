import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { updatePlaceVisit, updatePlaceVisitSchema } from "@/lib/place-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    visitId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { visitId } = await context.params;
    const input = updatePlaceVisitSchema.parse(await readJson(request));
    return NextResponse.json(await updatePlaceVisit(visitId, user.id, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
