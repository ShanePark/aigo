import { NextRequest, NextResponse } from "next/server";

import {
  AIGO_SESSION_COOKIE,
  createLoginSessionForAppUser,
  currentUserFromSessionToken,
  sessionCookieOptions,
  upsertAppUser
} from "@/lib/app-auth";
import { CURRENT_REQUIRED_CONSENT_VERSIONS } from "@/lib/consent-definitions";
import { recordRequiredConsents } from "@/lib/consents";
import { ApiError } from "@/lib/errors";
import {
  appUrl,
  decodeKakaoState,
  expiredKakaoStateCookieOptions,
  KAKAO_AUTH_STATE_COOKIE,
  kakaoProfileFromCode
} from "@/lib/kakao-auth";
import { findUserBySocialAccount, linkSocialAccount } from "@/lib/social-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const fallbackUrl = appUrl("/login", request);

  try {
    const state = decodeKakaoState(request.nextUrl.searchParams.get("state"));
    const expectedNonce = request.cookies.get(KAKAO_AUTH_STATE_COOKIE)?.value;
    if (!state || !expectedNonce || state.nonce !== expectedNonce) {
      throw new ApiError(400, "Kakao login state is invalid");
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      throw new ApiError(400, request.nextUrl.searchParams.get("error_description") ?? "Kakao login was cancelled");
    }

    const kakaoProfile = await kakaoProfileFromCode(request, code);
    if (state.mode === "link") {
      const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
      if (!user) {
        throw new ApiError(401, "Login required");
      }

      await linkSocialAccount(user.id, {
        provider: "kakao",
        providerEmail: kakaoProfile.email,
        providerUserId: kakaoProfile.kakaoId
      });
      const response = NextResponse.redirect(appUrl(state.nextPath, request));
      response.cookies.set(KAKAO_AUTH_STATE_COOKIE, "", expiredKakaoStateCookieOptions());
      return response;
    }

    const linkedUser = await findUserBySocialAccount("kakao", kakaoProfile.kakaoId);
    if (!linkedUser && state.mode !== "signup") {
      throw new ApiError(400, "회원가입하려면 필수 약관 동의가 필요합니다.");
    }
    if (state.mode === "signup") {
      if (!state.requiredConsents || !requiredConsentVersionsMatch(state.requiredConsents, CURRENT_REQUIRED_CONSENT_VERSIONS)) {
        throw new ApiError(400, "필수 약관 동의 기록이 없습니다.");
      }
    }

    const sessionUser = linkedUser ?? (await upsertAppUser(kakaoProfile));
    if (!linkedUser) {
      await recordRequiredConsents(sessionUser.id, request, { source: "signup" });
      await linkSocialAccount(sessionUser.id, {
        provider: "kakao",
        providerEmail: kakaoProfile.email,
        providerUserId: kakaoProfile.kakaoId
      });
    }
    const { expiresAt, token } = await createLoginSessionForAppUser(sessionUser);
    const response = NextResponse.redirect(appUrl(state.nextPath, request));
    response.cookies.set(AIGO_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    response.cookies.set(KAKAO_AUTH_STATE_COOKIE, "", expiredKakaoStateCookieOptions());
    return response;
  } catch (error) {
    const response = NextResponse.redirect(loginErrorUrl(fallbackUrl, error));
    response.cookies.set(KAKAO_AUTH_STATE_COOKIE, "", expiredKakaoStateCookieOptions());
    return response;
  }
}

function loginErrorUrl(url: URL, error: unknown) {
  if (error instanceof ApiError) {
    url.searchParams.set("error", [error.message, stringDetail(error.details)].filter(Boolean).join(": "));
  } else {
    console.error(error);
    url.searchParams.set("error", "Kakao login failed");
  }
  return url;
}

function stringDetail(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredConsentVersionsMatch(left: Record<string, string>, right: Record<string, string>) {
  return Object.entries(right).every(([key, value]) => left[key] === value);
}
