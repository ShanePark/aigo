import { NextRequest, NextResponse } from "next/server";

import { createKakaoAuthorizationUrl, KAKAO_AUTH_STATE_COOKIE, kakaoStateCookieOptions, safeNextPath } from "@/lib/kakao-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next") ?? undefined);
  const { nonce, url } = createKakaoAuthorizationUrl(request, nextPath);
  const response = NextResponse.redirect(url);
  response.cookies.set(KAKAO_AUTH_STATE_COOKIE, nonce, kakaoStateCookieOptions());
  return response;
}
