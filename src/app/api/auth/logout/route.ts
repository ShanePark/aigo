import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, deleteSessionByToken, expiredSessionCookieOptions } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await deleteSessionByToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AIGO_SESSION_COOKIE, "", expiredSessionCookieOptions());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
