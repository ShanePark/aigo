import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, createUserLoginSession, sessionCookieOptions } from "@/lib/app-auth";
import { ApiError } from "@/lib/errors";
import {
  decodeKakaoState,
  expiredKakaoStateCookieOptions,
  KAKAO_AUTH_STATE_COOKIE,
  kakaoProfileFromCode
} from "@/lib/kakao-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const fallbackUrl = new URL("/login", request.url);

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
    const { expiresAt, token } = await createUserLoginSession(kakaoProfile);
    const response = NextResponse.redirect(new URL(state.nextPath, request.url));
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
    url.searchParams.set("error", error.message);
  } else {
    console.error(error);
    url.searchParams.set("error", "Kakao login failed");
  }
  return url;
}
