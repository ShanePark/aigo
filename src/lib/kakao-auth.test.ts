import { afterEach, describe, expect, it } from "vitest";

import {
  decodeKakaoState,
  expiredKakaoStateCookieOptions,
  isKakaoLoginConfigured,
  kakaoStateCookieOptions,
  safeNextPath
} from "@/lib/kakao-auth";

const originalNodeEnv = process.env.NODE_ENV;
const originalKakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("kakao auth helpers", () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
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

    expect(decodeKakaoState(state)).toEqual({ mode: "login", nextPath: "/", nonce: "nonce" });
    expect(decodeKakaoState("not-json")).toBeNull();
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
