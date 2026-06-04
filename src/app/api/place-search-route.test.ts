import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserFromSessionToken: vi.fn(),
  recordVisitEventLater: vi.fn(),
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
  recordVisitEventLater: mocks.recordVisitEventLater
}));

import { POST as postPlaceSearch } from "@/app/places/search/route";
import { resetPublicReadRateLimitForTests } from "@/lib/public-rate-limit";

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
  afterEach(() => {
    delete process.env.AIGO_PUBLIC_SEARCH_RATE_LIMIT;
    resetPublicReadRateLimitForTests();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserFromSessionToken.mockResolvedValue({ id: userId });
    mocks.searchPlaces.mockResolvedValue({
      items: [{ placeId: "place-1" }, { placeId: "place-2" }],
      meta: { total: 12 }
    });
  });

  it("records searches even when no filters are supplied", async () => {
    const response = await postPlaceSearch(request({}));

    expect(response.status).toBe(200);
    expect(mocks.searchPlaces).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    await vi.waitFor(() => {
      expect(mocks.recordVisitEventLater).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "place_search",
          searchResultCount: 2,
          searchResultTotal: 12,
          user: { id: userId }
        })
      );
    });
    await expect(response.json()).resolves.toMatchObject({
      items: [{ placeId: "place-1" }, { placeId: "place-2" }]
    });
  });

  it("rate-limits public search calls before running the search", async () => {
    process.env.AIGO_PUBLIC_SEARCH_RATE_LIMIT = "1";

    expect((await postPlaceSearch(request({ query: "키즈카페" }))).status).toBe(200);
    const response = await postPlaceSearch(request({ query: "키즈카페" }));

    expect(response.status).toBe(429);
    expect(mocks.searchPlaces).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      details: { retryAfterSeconds: expect.any(Number) },
      error: "Too many public place requests"
    });
  });
});
