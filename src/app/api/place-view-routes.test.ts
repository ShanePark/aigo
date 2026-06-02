import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserFromSessionToken: vi.fn(),
  recordPlaceView: vi.fn(),
  recordPublicPlaceView: vi.fn(),
  recordVisitEventLater: vi.fn()
}));

vi.mock("@/lib/app-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/app-auth")>()),
  currentUserFromSessionToken: mocks.currentUserFromSessionToken
}));

vi.mock("@/lib/user-place-views", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/user-place-views")>()),
  recordPlaceView: mocks.recordPlaceView,
  recordPublicPlaceView: mocks.recordPublicPlaceView
}));

vi.mock("@/lib/visit-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/visit-events")>()),
  recordVisitEventLater: mocks.recordVisitEventLater
}));

import { POST as postPlaceView } from "@/app/api/places/[placeId]/views/route";

const userId = "11111111-1111-4111-8111-111111111111";
const placeId = "22222222-2222-4222-8222-222222222222";

function request(headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/places/test/views", {
    headers,
    method: "POST"
  });
}

function placeContext(id = placeId) {
  return {
    params: Promise.resolve({ placeId: id })
  } as never;
}

describe("place view API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserFromSessionToken.mockResolvedValue(null);
    mocks.recordPublicPlaceView.mockResolvedValue({
      item: { counted: true, placeId, publicViewCount: 8 }
    });
  });

  it("records anonymous public views with device and ip dedupe keys", async () => {
    const response = await postPlaceView(
      request({
        "x-forwarded-for": "203.0.113.1"
      }),
      placeContext()
    );

    expect(response.status).toBe(200);
    expect(mocks.recordPlaceView).not.toHaveBeenCalled();
    expect(mocks.recordVisitEventLater).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "place_detail_view",
        meta: { counted: true, publicViewCount: 8 },
        placeId,
        user: null
      })
    );
    expect(mocks.recordPublicPlaceView).toHaveBeenCalledWith(
      placeId,
      expect.arrayContaining([
        expect.objectContaining({ kind: "device" }),
        { kind: "ip", value: "203.0.113.1" }
      ])
    );
    expect(response.headers.get("set-cookie")).toContain("aigo_place_viewer=");
    await expect(response.json()).resolves.toMatchObject({
      item: { counted: true, placeId, publicViewCount: 8, userView: null }
    });
  });

  it("also records the signed-in user's recent-place view", async () => {
    mocks.currentUserFromSessionToken.mockResolvedValue({ id: userId });
    mocks.recordPlaceView.mockResolvedValue({
      item: { placeId, lastViewedAt: "2026-06-02T00:00:00.000Z", viewCount: 3 }
    });

    const response = await postPlaceView(request({ cookie: "aigo_place_viewer=device-1" }), placeContext());

    expect(response.status).toBe(200);
    expect(mocks.recordPublicPlaceView).toHaveBeenCalledWith(
      placeId,
      expect.arrayContaining([
        { kind: "user", value: userId },
        expect.objectContaining({ kind: "device" })
      ])
    );
    expect(mocks.recordPlaceView).toHaveBeenCalledWith(placeId, userId);
    expect(mocks.recordVisitEventLater).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceKey: "device-1",
        eventType: "place_detail_view",
        placeId,
        user: { id: userId }
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      item: {
        userView: { placeId, viewCount: 3 }
      }
    });
  });
});
