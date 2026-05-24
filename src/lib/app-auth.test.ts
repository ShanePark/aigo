import { afterEach, describe, expect, it } from "vitest";

import {
  AIGO_SESSION_COOKIE,
  expiredSessionCookieOptions,
  hashSessionToken,
  isDevLoginEnabled,
  sessionCookieOptions,
  sessionExpiresAt
} from "@/lib/app-auth";

const originalNodeEnv = process.env.NODE_ENV;
const originalDevLoginEnabled = process.env.AIGO_DEV_LOGIN_ENABLED;
const originalAigoEnv = process.env.AIGO_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("app auth helpers", () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    if (originalDevLoginEnabled === undefined) {
      delete process.env.AIGO_DEV_LOGIN_ENABLED;
    } else {
      process.env.AIGO_DEV_LOGIN_ENABLED = originalDevLoginEnabled;
    }
    if (originalAigoEnv === undefined) {
      delete process.env.AIGO_ENV;
    } else {
      process.env.AIGO_ENV = originalAigoEnv;
    }
  });

  it("exposes the expected session cookie name", () => {
    expect(AIGO_SESSION_COOKIE).toBe("aigo_session");
  });

  it("enables dev login outside production", () => {
    setNodeEnv("development");
    delete process.env.AIGO_DEV_LOGIN_ENABLED;

    expect(isDevLoginEnabled()).toBe(true);
  });

  it("keeps dev login disabled in production without a local or staging environment", () => {
    setNodeEnv("production");
    delete process.env.AIGO_DEV_LOGIN_ENABLED;
    delete process.env.AIGO_ENV;

    expect(isDevLoginEnabled()).toBe(false);

    process.env.AIGO_DEV_LOGIN_ENABLED = "true";
    expect(isDevLoginEnabled()).toBe(false);

    process.env.AIGO_ENV = "production";
    expect(isDevLoginEnabled()).toBe(false);
  });

  it("allows dev login for explicitly marked local and staging production builds", () => {
    setNodeEnv("production");
    process.env.AIGO_DEV_LOGIN_ENABLED = "true";

    process.env.AIGO_ENV = "local";
    expect(isDevLoginEnabled()).toBe(true);

    process.env.AIGO_ENV = "staging";
    expect(isDevLoginEnabled()).toBe(true);
  });

  it("hashes session tokens without storing the raw token", () => {
    const token = "session-token";

    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("uses httpOnly lax cookies and secure cookies in production", () => {
    const expiresAt = sessionExpiresAt(new Date("2026-05-24T00:00:00.000Z"));
    setNodeEnv("production");

    expect(sessionCookieOptions(expiresAt)).toMatchObject({
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true
    });
    expect(expiredSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true
    });
  });
});
