import { afterEach, describe, expect, it } from "vitest";

import { createPendingKakaoSignupToken, parsePendingKakaoSignupToken, PENDING_KAKAO_SIGNUP_COOKIE } from "@/lib/pending-kakao-signup";

const originalAigoAuthSecret = process.env.AIGO_AUTH_SECRET;

describe("pending Kakao signup tokens", () => {
  afterEach(() => {
    if (originalAigoAuthSecret === undefined) {
      delete process.env.AIGO_AUTH_SECRET;
    } else {
      process.env.AIGO_AUTH_SECRET = originalAigoAuthSecret;
    }
  });

  it("exposes the expected pending signup cookie name", () => {
    expect(PENDING_KAKAO_SIGNUP_COOKIE).toBe("aigo_pending_kakao_signup");
  });

  it("round-trips a signed pending Kakao signup profile", () => {
    process.env.AIGO_AUTH_SECRET = "test-secret";
    const now = new Date("2026-06-03T00:00:00.000Z");
    const token = createPendingKakaoSignupToken(
      {
        nextPath: "/me",
        profile: {
          displayName: "AiGo User",
          email: "signup@example.test",
          kakaoId: "kakao-1"
        }
      },
      now
    );

    expect(parsePendingKakaoSignupToken(token, now)).toMatchObject({
      nextPath: "/me",
      profile: {
        email: "signup@example.test",
        kakaoId: "kakao-1"
      }
    });
  });

  it("rejects tampered and expired tokens", () => {
    process.env.AIGO_AUTH_SECRET = "test-secret";
    const now = new Date("2026-06-03T00:00:00.000Z");
    const token = createPendingKakaoSignupToken(
      {
        nextPath: "/me",
        profile: {
          displayName: "AiGo User",
          email: "signup@example.test",
          kakaoId: "kakao-1"
        }
      },
      now
    );

    expect(parsePendingKakaoSignupToken(`${token.slice(0, -1)}x`, now)).toBeNull();
    expect(parsePendingKakaoSignupToken(token, new Date("2026-06-03T00:11:00.000Z"))).toBeNull();
  });
});
