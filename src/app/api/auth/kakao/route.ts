import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { ApiError, apiErrorResponse } from "@/lib/errors";
import { createKakaoAuthorizationUrl, KAKAO_AUTH_STATE_COOKIE, kakaoStateCookieOptions, safeNextPath } from "@/lib/kakao-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const nextPath = safeNextPath(request.nextUrl.searchParams.get("next") ?? undefined);
    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode = modeParam === "link" ? modeParam : "login";
    if (mode === "link") {
      const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
      if (!user) {
        throw new ApiError(401, "Login required");
      }
    }

    const { nonce, url } = createKakaoAuthorizationUrl(request, nextPath, mode);
    const response = NextResponse.redirect(url);
    response.cookies.set(KAKAO_AUTH_STATE_COOKIE, nonce, kakaoStateCookieOptions());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
