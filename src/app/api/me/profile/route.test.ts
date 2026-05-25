import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  requireCurrentUser: vi.fn(),
  schemaParse: vi.fn((value: unknown) => value),
  updateMyProfile: vi.fn()
}));

vi.mock("@/lib/app-auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser
}));

vi.mock("@/lib/user-profile", () => ({
  getMyProfile: mocks.getMyProfile,
  updateMyProfile: mocks.updateMyProfile,
  updateMyProfileSchema: {
    parse: mocks.schemaParse
  }
}));

import { GET, PATCH } from "@/app/api/me/profile/route";

function request(method = "GET", body?: unknown) {
  return new NextRequest("http://localhost/api/me/profile", {
    body: body === undefined ? undefined : JSON.stringify(body),
    method
  });
}

describe("profile API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires login before returning profile data", async () => {
    mocks.requireCurrentUser.mockRejectedValue(new ApiError(401, "Login required"));

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Login required" });
    expect(mocks.getMyProfile).not.toHaveBeenCalled();
  });

  it("returns the current user's profile", async () => {
    mocks.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getMyProfile.mockResolvedValue({ children: [], homeLocation: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.getMyProfile).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toMatchObject({
      children: [],
      homeLocation: null
    });
  });

  it("updates only the current user's profile with parsed input", async () => {
    const input = { children: [{ birthYearMonth: "2024-09", gender: "girl" }] };
    mocks.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.schemaParse.mockReturnValue(input);
    mocks.updateMyProfile.mockResolvedValue({ children: [{ id: "child-1", birthYearMonth: "2024-09", gender: "girl", sortOrder: 0 }] });

    const response = await PATCH(request("PATCH", input));

    expect(response.status).toBe(200);
    expect(mocks.schemaParse).toHaveBeenCalledWith(input);
    expect(mocks.updateMyProfile).toHaveBeenCalledWith("user-1", input);
    await expect(response.json()).resolves.toMatchObject({
      children: [{ id: "child-1", birthYearMonth: "2024-09", gender: "girl" }]
    });
  });
});
