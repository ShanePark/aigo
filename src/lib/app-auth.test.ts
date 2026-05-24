import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AIGO_SESSION_COOKIE,
  cleanupExpiredAuthSessions,
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

function fakeExecutor(options: { reject?: boolean } = {}) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    if (options.reject) {
      throw new Error("database unavailable");
    }
    return [];
  }) as never;

  return { calls, executor };
}

describe("app auth helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("cleans up expired auth sessions", async () => {
    const { calls, executor } = fakeExecutor();

    await cleanupExpiredAuthSessions(executor);

    expect(calls[0]).toContain("delete from auth_sessions");
    expect(calls[0]).toContain("expires_at <= now()");
  });

  it("does not throw when expired session cleanup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { executor } = fakeExecutor({ reject: true });

    await expect(cleanupExpiredAuthSessions(executor)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Failed to clean up expired auth sessions", expect.any(Error));
  });
});
