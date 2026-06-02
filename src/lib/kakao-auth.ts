import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";
import { isCurrentPrivacyPolicyConsent, type PrivacyPolicyConsentVersion } from "@/lib/consent-definitions";

export const KAKAO_AUTH_STATE_COOKIE = "aigo_kakao_oauth_state";

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me";
const STATE_MAX_AGE_SECONDS = 10 * 60;

type KakaoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoUserResponse = {
  id?: number | string;
  kakao_account?: {
    email?: string;
  };
};

export type KakaoLoginProfile = {
  displayName: string;
  email: string;
  kakaoId: string;
};

export type KakaoAuthMode = "link" | "login";
export type KakaoAuthPrivacyConsent = {
  privacyPolicyVersion: PrivacyPolicyConsentVersion;
};

export function isKakaoLoginConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.KAKAO_REST_API_KEY);
}

export function kakaoStateCookieOptions() {
  return {
    httpOnly: true,
    maxAge: STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function expiredKakaoStateCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function createKakaoAuthorizationUrl(
  request: NextRequest,
  nextPath: string,
  mode: KakaoAuthMode = "login",
  privacyConsent?: KakaoAuthPrivacyConsent | null
) {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    throw new ApiError(503, "Kakao login is not configured");
  }

  const nonce = randomBytes(24).toString("base64url");
  const redirectUri = kakaoRedirectUri(request);
  const state = encodeState({ mode, nextPath, nonce, privacyConsent: privacyConsent ?? null });
  const url = new URL(KAKAO_AUTHORIZE_URL);
  url.searchParams.set("client_id", restApiKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return { nonce, url };
}

export async function kakaoProfileFromCode(request: NextRequest, code: string) {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    throw new ApiError(503, "Kakao login is not configured");
  }

  const tokenBody = new URLSearchParams({
    client_id: restApiKey,
    code,
    grant_type: "authorization_code",
    redirect_uri: kakaoRedirectUri(request)
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    tokenBody.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
    body: tokenBody,
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    method: "POST"
  });
  const token = (await tokenResponse.json().catch(() => null)) as KakaoTokenResponse | null;
  if (!tokenResponse.ok || !token?.access_token) {
    const detail = token?.error_description ?? token?.error ?? `HTTP ${tokenResponse.status}`;
    console.warn("Kakao token exchange failed", { detail, status: tokenResponse.status });
    throw new ApiError(401, "Kakao token exchange failed", detail);
  }

  const userResponse = await fetch(KAKAO_USER_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
    method: "GET"
  });
  const user = (await userResponse.json().catch(() => null)) as KakaoUserResponse | null;
  if (!userResponse.ok || user?.id === undefined || user.id === null) {
    throw new ApiError(401, "Kakao profile lookup failed");
  }

  return kakaoLoginProfile(user);
}

export function decodeKakaoState(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      mode?: unknown;
      nextPath?: unknown;
      nonce?: unknown;
      privacyConsent?: unknown;
    };
    if (typeof parsed.nonce !== "string" || typeof parsed.nextPath !== "string") return null;
    return {
      mode: parsed.mode === "link" ? "link" : ("login" as KakaoAuthMode),
      nextPath: safeNextPath(parsed.nextPath),
      nonce: parsed.nonce,
      privacyConsent: parsePrivacyConsent(parsed.privacyConsent)
    };
  } catch {
    return null;
  }
}

export function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

function parsePrivacyConsent(value: unknown): KakaoAuthPrivacyConsent | null {
  if (!value || typeof value !== "object") return null;
  const rawVersion = (value as { privacyPolicyVersion?: unknown }).privacyPolicyVersion;
  const version = typeof rawVersion === "string" ? rawVersion : null;
  return isCurrentPrivacyPolicyConsent(version) ? { privacyPolicyVersion: version } : null;
}

function encodeState(value: { mode: KakaoAuthMode; nextPath: string; nonce: string; privacyConsent: KakaoAuthPrivacyConsent | null }) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function kakaoRedirectUri(request: NextRequest) {
  return new URL("/api/auth/kakao/callback", appOrigin(request)).toString();
}

export function appUrl(path: string, request: NextRequest) {
  return new URL(path, appOrigin(request));
}

function appOrigin(request: NextRequest) {
  const configuredOrigin = process.env.AIGO_APP_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  return request.url;
}

function kakaoLoginProfile(user: KakaoUserResponse): KakaoLoginProfile {
  const kakaoId = String(user.id);
  const email = user.kakao_account?.email?.trim().toLowerCase() || `kakao-${kakaoId}@kakao.aigo.local`;

  return { displayName: "AiGo User", email, kakaoId };
}
