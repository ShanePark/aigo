import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { listPlaceSaveStates, placeSaveStatesRequestSchema } from "@/lib/user-place-saves";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const input = placeSaveStatesRequestSchema.parse(await readJson(request));
    return NextResponse.json(await listPlaceSaveStates(input.placeIds, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
