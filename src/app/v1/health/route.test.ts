import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  getAgentHealth: vi.fn(),
  requireHealthApiKey: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireHealthApiKey: mocks.requireHealthApiKey
}));

vi.mock("@/lib/health", () => ({
  getAgentHealth: mocks.getAgentHealth
}));

import { GET } from "@/app/v1/health/route";

function request() {
  return new NextRequest("http://localhost/v1/health", {
    headers: {
      authorization: "Bearer test-key"
    }
  });
}

describe("agent health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks API key before returning health", async () => {
    const health = {
      ok: true,
      service: "aigo-api",
      auth: "ok",
      database: "ok",
      checkedAt: "2026-05-27T00:00:00.000Z"
    };
    mocks.getAgentHealth.mockResolvedValue(health);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.requireHealthApiKey).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(health);
  });

  it("returns the auth error without checking database health", async () => {
    mocks.requireHealthApiKey.mockImplementation(() => {
      throw new ApiError(401, "Missing or invalid API key");
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.getAgentHealth).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: "Missing or invalid API key" });
  });
});
