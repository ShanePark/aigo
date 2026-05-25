import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { listRecentPlaces, recentPlacesLimitSchema } from "@/lib/user-place-views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const limit = recentPlacesLimitSchema.parse(request.nextUrl.searchParams.get("limit") ?? undefined);
    return NextResponse.json(await listRecentPlaces(user.id, limit));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
