import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { isCurrentPrivacyPolicyConsent, PRIVACY_POLICY_CONSENT } from "@/lib/consent-definitions";
import { ApiError, apiErrorResponse } from "@/lib/errors";
import { createKakaoAuthorizationUrl, KAKAO_AUTH_STATE_COOKIE, kakaoStateCookieOptions, safeNextPath } from "@/lib/kakao-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const nextPath = safeNextPath(request.nextUrl.searchParams.get("next") ?? undefined);
    const mode = request.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";
    const privacyPolicyVersion = request.nextUrl.searchParams.get("privacyPolicyVersion");
    if (mode === "link") {
      const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
      if (!user) {
        throw new ApiError(401, "Login required");
      }
    } else if (!isCurrentPrivacyPolicyConsent(privacyPolicyVersion)) {
      throw new ApiError(400, "개인정보 처리방침 동의가 필요합니다.");
    }

    const { nonce, url } = createKakaoAuthorizationUrl(
      request,
      nextPath,
      mode,
      mode === "login" ? { privacyPolicyVersion: PRIVACY_POLICY_CONSENT.version } : null
    );
    const response = NextResponse.redirect(url);
    response.cookies.set(KAKAO_AUTH_STATE_COOKIE, nonce, kakaoStateCookieOptions());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
