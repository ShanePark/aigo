import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, createLoginSessionForAppUser, sessionCookieOptions, upsertAppUser } from "@/lib/app-auth";
import { isCurrentRequiredConsentVersions, type RequiredConsentStateKey } from "@/lib/consent-definitions";
import { recordRequiredConsents } from "@/lib/consents";
import { ApiError } from "@/lib/errors";
import { appUrl, safeNextPath } from "@/lib/kakao-auth";
import {
  expiredPendingKakaoSignupCookieOptions,
  parsePendingKakaoSignupToken,
  PENDING_KAKAO_SIGNUP_COOKIE
} from "@/lib/pending-kakao-signup";
import { findUserBySocialAccount, linkSocialAccount } from "@/lib/social-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const fallbackUrl = appUrl("/login", request);

  try {
    const pendingSignup = parsePendingKakaoSignupToken(request.cookies.get(PENDING_KAKAO_SIGNUP_COOKIE)?.value);
    if (!pendingSignup) {
      throw new ApiError(400, "회원가입 정보가 만료되었습니다.");
    }

    const formData = await request.formData();
    const requiredConsents = {
      locationTermsVersion: stringValue(formData.get("locationTermsVersion")),
      privacyPolicyVersion: stringValue(formData.get("privacyPolicyVersion")),
      termsVersion: stringValue(formData.get("termsVersion"))
    } satisfies Partial<Record<RequiredConsentStateKey, string | null>>;
    if (!isCurrentRequiredConsentVersions(requiredConsents)) {
      throw new ApiError(400, "필수 약관 동의가 필요합니다.");
    }

    const linkedUser = await findUserBySocialAccount("kakao", pendingSignup.profile.kakaoId);
    const sessionUser = linkedUser ?? (await upsertAppUser(pendingSignup.profile));
    if (!linkedUser) {
      await recordRequiredConsents(sessionUser.id, request, { source: "signup" });
      await linkSocialAccount(sessionUser.id, {
        provider: "kakao",
        providerEmail: pendingSignup.profile.email,
        providerUserId: pendingSignup.profile.kakaoId
      });
    }

    const { expiresAt, token } = await createLoginSessionForAppUser(sessionUser);
    const nextPath = safeNextPath(stringValue(formData.get("next")) ?? pendingSignup.nextPath);
    const response = NextResponse.redirect(appUrl(nextPath, request), 303);
    response.cookies.set(AIGO_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    response.cookies.set(PENDING_KAKAO_SIGNUP_COOKIE, "", expiredPendingKakaoSignupCookieOptions());
    return response;
  } catch (error) {
    const url = new URL(fallbackUrl);
    url.searchParams.set("error", error instanceof ApiError ? error.message : "회원가입에 실패했습니다.");
    const response = NextResponse.redirect(url, 303);
    if (error instanceof ApiError && error.status < 500) {
      response.cookies.set(PENDING_KAKAO_SIGNUP_COOKIE, "", expiredPendingKakaoSignupCookieOptions());
    }
    return response;
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : null;
}
