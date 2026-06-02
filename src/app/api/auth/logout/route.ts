import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, deleteSessionByToken, expiredSessionCookieOptions } from "@/lib/app-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let sessionDeleted = true;

  try {
    await deleteSessionByToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
  } catch (error) {
    sessionDeleted = false;
    console.warn("Failed to delete auth session during logout", error);
  }

  const response = NextResponse.json({ ok: true, sessionDeleted });
  response.cookies.set(AIGO_SESSION_COOKIE, "", expiredSessionCookieOptions());
  return response;
}
