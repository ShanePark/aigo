import { describe, expect, it } from "vitest";

import { buildLocationSearchState } from "@/app/location-search-state";
import { searchPlacesSchema } from "@/lib/schemas";

const baseInput = searchPlacesSchema.parse({
  filterByRadius: false,
  limit: 50,
  offset: 150,
  origin: {
    label: "전국 지도 중심",
    lat: 36.5,
    lng: 127.8
  },
  sort: "recommended"
});

describe("location search state", () => {
  it("builds a home search that clears stale map/page state and keeps category-specific radius", () => {
    const state = buildLocationSearchState({
      activeInput: baseInput,
      activeParams: {
        categoryGroup: "visit",
        lat: "35.000000",
        lng: "126.000000",
        maxLat: "35.100000",
        maxLng: "126.100000",
        minLat: "35.000000",
        minLng: "126.000000",
        nearby: "1",
        page: "4",
        query: "과학관",
        sort: "recommended"
      },
      activeSort: "recommended",
      formQuery: "  어린이 체험  ",
      kind: "home",
      location: { lat: 36.33, lng: 127.43 }
    });

    expect(state.params).toEqual({
      categoryGroup: "visit",
      home: "1",
      lat: "36.330000",
      lng: "127.430000",
      query: "어린이 체험",
      sort: "recommended"
    });
    expect(state.input).toMatchObject({
      filterByRadius: true,
      offset: 0,
      origin: {
        label: "집 위치",
        lat: 36.33,
        lng: 127.43
      },
      query: "어린이 체험",
      radiusKm: 220,
      sort: "recommended",
      viewportBounds: undefined
    });
  });

  it("builds a current-location search without marking it as home", () => {
    const state = buildLocationSearchState({
      activeInput: searchPlacesSchema.parse({ ...baseInput, sort: "distance" }),
      activeParams: {
        categoryGroup: "playground",
        home: "1",
        lat: "36.330000",
        lng: "127.430000",
        page: "2",
        sort: "distance"
      },
      activeSort: "distance",
      kind: "current",
      location: { lat: 37.5665, lng: 126.978 }
    });

    expect(state.params).toEqual({
      categoryGroup: "playground",
      lat: "37.566500",
      lng: "126.978000",
      nearby: "1",
      sort: "distance"
    });
    expect(state.input).toMatchObject({
      filterByRadius: true,
      offset: 0,
      origin: {
        label: "현재 위치",
        lat: 37.5665,
        lng: 126.978
      },
      radiusKm: 20,
      sort: "distance",
      viewportBounds: undefined
    });
  });
});
