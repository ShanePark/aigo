import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteSessionByToken: vi.fn()
}));

vi.mock("@/lib/app-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/app-auth")>()),
  deleteSessionByToken: mocks.deleteSessionByToken
}));

import { AIGO_SESSION_COOKIE } from "@/lib/app-auth";
import { POST } from "@/app/api/auth/logout/route";

function request(cookieValue = "session-token") {
  return new NextRequest("http://localhost/api/auth/logout", {
    headers: {
      cookie: `${AIGO_SESSION_COOKIE}=${cookieValue}`
    },
    method: "POST"
  });
}

describe("logout API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the current session and expires the browser cookie", async () => {
    mocks.deleteSessionByToken.mockResolvedValue(undefined);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.deleteSessionByToken).toHaveBeenCalledWith("session-token");
    expect(response.headers.get("set-cookie")).toContain(`${AIGO_SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toEqual({ ok: true, sessionDeleted: true });
  });

  it("still expires the browser cookie when server-side session cleanup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.deleteSessionByToken.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${AIGO_SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toEqual({ ok: true, sessionDeleted: false });
    expect(warn).toHaveBeenCalledWith("Failed to delete auth session during logout", expect.any(Error));
  });
});
