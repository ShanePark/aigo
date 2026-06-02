import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  appUrl,
  createKakaoAuthorizationUrl,
  decodeKakaoState,
  expiredKakaoStateCookieOptions,
  isKakaoLoginConfigured,
  kakaoStateCookieOptions,
  safeNextPath
} from "@/lib/kakao-auth";

const originalNodeEnv = process.env.NODE_ENV;
const originalAigoAppOrigin = process.env.AIGO_APP_ORIGIN;
const originalKakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("kakao auth helpers", () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    if (originalAigoAppOrigin === undefined) {
      delete process.env.AIGO_APP_ORIGIN;
    } else {
      process.env.AIGO_APP_ORIGIN = originalAigoAppOrigin;
    }
    if (originalKakaoRestApiKey === undefined) {
      delete process.env.KAKAO_REST_API_KEY;
    } else {
      process.env.KAKAO_REST_API_KEY = originalKakaoRestApiKey;
    }
  });

  it("reports Kakao login configuration from the REST API key", () => {
    delete process.env.KAKAO_REST_API_KEY;
    expect(isKakaoLoginConfigured()).toBe(false);

    process.env.KAKAO_REST_API_KEY = "test-key";
    expect(isKakaoLoginConfigured()).toBe(true);
  });

  it("sanitizes next paths before redirecting", () => {
    expect(safeNextPath("/saved-places?filter=hearted")).toBe("/saved-places?filter=hearted");
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//example.com")).toBe("/");
    expect(safeNextPath("/login?next=/me")).toBe("/");
  });

  it("decodes state and falls back to home for unsafe next paths", () => {
    const state = Buffer.from(JSON.stringify({ nextPath: "https://example.com", nonce: "nonce" }), "utf8").toString("base64url");

    expect(decodeKakaoState(state)).toEqual({ mode: "login", nextPath: "/", nonce: "nonce", requiredConsents: null });
    expect(decodeKakaoState("not-json")).toBeNull();
  });

  it("does not require consent versions for a login state", () => {
    process.env.KAKAO_REST_API_KEY = "test-key";

    const request = new NextRequest("https://localhost:3000/api/auth/kakao");
    const { url } = createKakaoAuthorizationUrl(request, "/me", "login");
    const state = decodeKakaoState(url.searchParams.get("state"));

    expect(state).toMatchObject({
      mode: "login",
      nextPath: "/me",
      requiredConsents: null
    });
  });

  it("uses the configured app origin for Kakao redirect URIs", () => {
    process.env.KAKAO_REST_API_KEY = "test-key";
    process.env.AIGO_APP_ORIGIN = "https://aigo.example";

    const request = new NextRequest("https://localhost:3000/api/auth/kakao");
    const { url } = createKakaoAuthorizationUrl(request, "/");

    expect(url.searchParams.get("redirect_uri")).toBe("https://aigo.example/api/auth/kakao/callback");
  });

  it("uses the configured app origin for local app redirects", () => {
    process.env.AIGO_APP_ORIGIN = "https://aigo.example";

    const request = new NextRequest("https://localhost:3000/api/auth/kakao/callback");

    expect(appUrl("/login?error=Kakao+login+failed", request).toString()).toBe("https://aigo.example/login?error=Kakao+login+failed");
    expect(appUrl("/saved-places", request).toString()).toBe("https://aigo.example/saved-places");
  });

  it("uses secure state cookies in production", () => {
    setNodeEnv("production");

    expect(kakaoStateCookieOptions()).toMatchObject({
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
      secure: true
    });
    expect(expiredKakaoStateCookieOptions()).toMatchObject({
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true
    });
  });
});
