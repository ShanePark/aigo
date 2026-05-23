import { describe, expect, it } from "vitest";

import { buildSearchInput } from "@/app/home-search-state";

describe("home search input", () => {
  it("does not apply the default radius filter to a plain text search", () => {
    expect(buildSearchInput({ query: "서울 키즈카페" })).toMatchObject({
      filterByRadius: false,
      query: "서울 키즈카페",
      radiusKm: undefined,
      viewportBounds: undefined
    });
  });

  it("keeps explicit viewport searches bounded even when a query is present", () => {
    expect(
      buildSearchInput({
        lat: "36.330000",
        lng: "127.440000",
        maxLat: "36.360000",
        maxLng: "127.480000",
        minLat: "36.300000",
        minLng: "127.400000",
        query: "키즈카페"
      })
    ).toMatchObject({
      filterByRadius: false,
      query: "키즈카페",
      radiusKm: undefined,
      viewportBounds: {
        maxLat: 36.36,
        maxLng: 127.48,
        minLat: 36.3,
        minLng: 127.4
      }
    });
  });

  it("keeps category browsing within the default radius", () => {
    expect(buildSearchInput({ categoryGroup: "kidsCafe" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 80
    });
  });
});
