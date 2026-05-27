import { NextRequest, NextResponse } from "next/server";

import {
  AIGO_SESSION_COOKIE,
  currentUserFromSessionToken,
  expiredSessionCookieOptions
} from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(AIGO_SESSION_COOKIE)?.value;
    const user = await currentUserFromSessionToken(sessionToken);
    const response = NextResponse.json({ user: user ? { id: user.id } : null });

    if (sessionToken && !user) {
      response.cookies.set(AIGO_SESSION_COOKIE, "", expiredSessionCookieOptions());
    }

    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
