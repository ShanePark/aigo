import { createHmac, timingSafeEqual } from "node:crypto";

import type { KakaoLoginProfile } from "@/lib/kakao-auth";

export const PENDING_KAKAO_SIGNUP_COOKIE = "aigo_pending_kakao_signup";

const PENDING_SIGNUP_TTL_SECONDS = 10 * 60;

export type PendingKakaoSignup = {
  exp: number;
  nextPath: string;
  profile: KakaoLoginProfile;
};

export function pendingKakaoSignupCookieOptions() {
  return {
    httpOnly: true,
    maxAge: PENDING_SIGNUP_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function expiredPendingKakaoSignupCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function createPendingKakaoSignupToken(input: { nextPath: string; profile: KakaoLoginProfile }, now = new Date()) {
  const payload: PendingKakaoSignup = {
    exp: Math.floor(now.getTime() / 1000) + PENDING_SIGNUP_TTL_SECONDS,
    nextPath: input.nextPath,
    profile: input.profile
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function parsePendingKakaoSignupToken(value: string | undefined | null, now = new Date()) {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || !signatureMatches(encodedPayload, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<PendingKakaoSignup>;
    if (!payload.exp || payload.exp < Math.floor(now.getTime() / 1000)) return null;
    if (!payload.profile || typeof payload.profile.kakaoId !== "string" || typeof payload.profile.email !== "string") return null;
    if (typeof payload.profile.displayName !== "string" || typeof payload.nextPath !== "string") return null;

    return payload as PendingKakaoSignup;
  } catch {
    return null;
  }
}

function signatureMatches(encodedPayload: string, signature: string) {
  const expected = sign(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function sign(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function signingSecret() {
  return process.env.AIGO_AUTH_SECRET || process.env.KAKAO_CLIENT_SECRET || process.env.KAKAO_REST_API_KEY || "aigo-local-dev-auth-secret";
}
