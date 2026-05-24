import { NextResponse } from "next/server";

import {
  AIGO_SESSION_COOKIE,
  createDevLoginSession,
  isDevLoginEnabled,
  sessionCookieOptions
} from "@/lib/app-auth";
import { ApiError, apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    if (!isDevLoginEnabled()) {
      throw new ApiError(404, "Dev login is disabled");
    }

    const { expiresAt, token, user } = await createDevLoginSession();
    const response = NextResponse.json({ user });
    response.cookies.set(AIGO_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
