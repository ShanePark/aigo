import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserFromSessionToken: vi.fn(),
  recordVisitEvent: vi.fn(),
  searchPlaces: vi.fn()
}));

vi.mock("@/lib/app-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/app-auth")>()),
  currentUserFromSessionToken: mocks.currentUserFromSessionToken
}));

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  searchPlaces: mocks.searchPlaces
}));

vi.mock("@/lib/visit-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/visit-events")>()),
  recordVisitEvent: mocks.recordVisitEvent
}));

import { POST as postPlaceSearch } from "@/app/places/search/route";

const userId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown = {}) {
  return new NextRequest("http://localhost/places/search", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 Test Browser",
      "x-forwarded-for": "203.0.113.2"
    },
    method: "POST"
  });
}

describe("place search route analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserFromSessionToken.mockResolvedValue({ id: userId });
    mocks.recordVisitEvent.mockResolvedValue({ id: "event-1" });
    mocks.searchPlaces.mockResolvedValue({
      items: [{ placeId: "place-1" }, { placeId: "place-2" }],
      meta: { total: 12 }
    });
  });

  it("records searches even when no filters are supplied", async () => {
    const response = await postPlaceSearch(request({}));

    expect(response.status).toBe(200);
    expect(mocks.searchPlaces).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    expect(mocks.recordVisitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "place_search",
        searchResultCount: 2,
        searchResultTotal: 12,
        user: { id: userId }
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      items: [{ placeId: "place-1" }, { placeId: "place-2" }]
    });
  });
});
