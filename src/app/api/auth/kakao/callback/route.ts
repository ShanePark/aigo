import { NextRequest, NextResponse } from "next/server";

import {
  AIGO_SESSION_COOKIE,
  createLoginSessionForAppUser,
  currentUserFromSessionToken,
  sessionCookieOptions,
  upsertAppUser
} from "@/lib/app-auth";
import { PRIVACY_POLICY_CONSENT } from "@/lib/consent-definitions";
import { recordPrivacyPolicyConsent } from "@/lib/consents";
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

    if (state.privacyConsent?.privacyPolicyVersion !== PRIVACY_POLICY_CONSENT.version) {
      throw new ApiError(400, "개인정보 처리방침 동의 기록이 없습니다.");
    }
    const linkedUser = await findUserBySocialAccount("kakao", kakaoProfile.kakaoId);
    const sessionUser = linkedUser ?? (await upsertAppUser(kakaoProfile));
    await recordPrivacyPolicyConsent(sessionUser.id, request, { source: linkedUser ? "login" : "signup" });
    if (!linkedUser) {
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
