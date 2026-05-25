import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { listSavedPlaces, savedPlacesFilterSchema } from "@/lib/user-place-saves";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const filter = savedPlacesFilterSchema.parse(request.nextUrl.searchParams.get("filter") ?? "all");
    return NextResponse.json(await listSavedPlaces(user.id, filter));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
