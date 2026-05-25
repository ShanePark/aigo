import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { getMyProfile, updateMyProfile, updateMyProfileSchema } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    return NextResponse.json(await getMyProfile(user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const input = updateMyProfileSchema.parse(await readJson(request));
    return NextResponse.json(await updateMyProfile(user.id, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const PUT = PATCH;
