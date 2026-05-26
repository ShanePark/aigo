import { describe, expect, it } from "vitest";

import { buildSearchInput, resultLimitParam, sortParam } from "@/app/home-search-state";

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

  it("keeps kids cafe category browsing within the general local radius", () => {
    expect(buildSearchInput({ categoryGroup: "kidsCafe", lat: "36.35", lng: "127.38" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 80
    });
  });

  it("labels saved home location searches separately from current location searches", () => {
    expect(buildSearchInput({ home: "1", lat: "36.33", lng: "127.43" })).toMatchObject({
      filterByRadius: true,
      origin: {
        label: "집 위치",
        lat: 36.33,
        lng: 127.43
      },
      radiusKm: 80
    });
  });

  it("preserves duplicate child profiles as separate search age signals", () => {
    expect(buildSearchInput({ children: "girl:6-12,girl:6-12,boy:24-48" })).toMatchObject({
      childAgeMonths: [7, 7, 32]
    });
  });

  it("uses category-specific default radii for distance-sensitive browsing", () => {
    expect(buildSearchInput({ categoryGroup: "playground", lat: "36.35", lng: "127.38" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 20
    });
    expect(buildSearchInput({ categoryGroup: "visit", lat: "36.35", lng: "127.38" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 220
    });
    expect(buildSearchInput({ categoryGroup: "stay", lat: "36.35", lng: "127.38" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 300
    });
  });

  it("combines multiple selected category groups into one search", () => {
    expect(
      buildSearchInput({
        categoryGroups: ["shopping", "visit"],
        lat: "36.35",
        lng: "127.38"
      })
    ).toMatchObject({
      filterByRadius: true,
      radiusKm: 220,
      primaryCategories: expect.arrayContaining(["shopping_mall", "science_museum", "museum", "art_museum", "aquarium", "zoo"])
    });
  });

  it("keeps legacy single category group URLs working", () => {
    expect(buildSearchInput({ categoryGroup: "shopping", lat: "36.35", lng: "127.38" })).toMatchObject({
      filterByRadius: true,
      radiusKm: 80,
      primaryCategories: ["shopping_mall"]
    });
  });

  it("keeps detail filters as ranking preferences from search params", () => {
    expect(
      buildSearchInput({
        diaperChangingTable: "on",
        indoor: "on",
        kidsToilet: "on",
        nursing: "on",
        parking: "on",
        toiletNearby: "on",
        preferenceMode: "required"
      })
    ).toMatchObject({
      preferences: {
        diaperChangingTable: true,
        indoorTypes: ["indoor", "mixed"],
        kidsToilet: true,
        nursingRoom: true,
        parkingAvailable: true,
        toiletNearby: true
      }
    });
    expect(
      buildSearchInput({
        elevator: "on",
        foodAllowed: "on",
        stroller: "on"
      }).preferences
    ).not.toHaveProperty("elevator");
    expect(
      buildSearchInput({
        elevator: "on",
        foodAllowed: "on",
        stroller: "on"
      }).preferences
    ).not.toHaveProperty("foodAllowed");
    expect(
      buildSearchInput({
        elevator: "on",
        foodAllowed: "on",
        stroller: "on"
      }).preferences
    ).not.toHaveProperty("strollerFriendly");
    expect(buildSearchInput({ parking: "on", preferenceMode: "required" })).not.toHaveProperty("preferenceMode");
  });

  it("treats explicit off preference params as URL overrides without applying filters", () => {
    expect(buildSearchInput({ indoor: "off", nursing: "off", preferenceMode: "soft" })).toMatchObject({
      preferences: {
        indoorTypes: undefined,
        nursingRoom: undefined
      }
    });
    expect(buildSearchInput({ indoor: "off", nursing: "off", preferenceMode: "soft" })).not.toHaveProperty("preferenceMode");
  });

  it("uses the supported result page sizes", () => {
    expect(resultLimitParam({})).toBe(50);
    expect(resultLimitParam({ limit: "30" })).toBe(50);
    expect(resultLimitParam({ limit: "100" })).toBe(100);
  });

  it("accepts rating sort for place evaluation ordering", () => {
    expect(sortParam({ sort: "rating" })).toBe("rating");
    expect(buildSearchInput({ sort: "rating" })).toMatchObject({
      sort: "rating"
    });
  });

  it("passes play filters as taxonomy facets from search params", () => {
    expect(buildSearchInput({ sandPlay: "on" })).toMatchObject({
      taxonomy: {
        mode: "soft",
        activityTypes: ["sand_play"]
      }
    });
    expect(buildSearchInput({ handsOnExperience: "on", readingBooks: "on", sandPlay: "on", waterPlay: "on", preferenceMode: "required" })).toMatchObject({
      taxonomy: {
        mode: "soft",
        activityTypes: ["sand_play", "water_play"]
      }
    });
  });
});
