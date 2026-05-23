import { describe, expect, it } from "vitest";

import { searchParamsForViewportSearch, searchParamsWithCurrentLocationState } from "@/app/search-url-state";

describe("search URL state", () => {
  it("records viewport searches without keeping stale radius state", () => {
    expect(
      searchParamsForViewportSearch(
        {
          categoryGroup: "kidsCafe",
          nearby: "1",
          nursing: "on",
          offset: "30",
          page: "2",
          query: "키즈카페",
          radiusKm: "20",
          sort: "distance"
        },
        {
          bounds: {
            minLat: 36.3,
            minLng: 127.4,
            maxLat: 36.36,
            maxLng: 127.48
          },
          center: {
            lat: 36.33,
            lng: 127.44
          }
        }
      )
    ).toEqual({
      categoryGroup: "kidsCafe",
      lat: "36.330000",
      lng: "127.440000",
      maxLat: "36.360000",
      maxLng: "127.480000",
      minLat: "36.300000",
      minLng: "127.400000",
      nursing: "on",
      query: "키즈카페",
      sort: "distance"
    });
  });

  it("adds form filters while preserving the current map viewport over stale hidden inputs", () => {
    const formData = new FormData();
    formData.set("query", "수유실");
    formData.set("sort", "recommended");
    formData.set("limit", "30");
    formData.set("nursing", "on");
    formData.set("minLat", "35.000000");
    formData.set("minLng", "126.000000");
    formData.set("maxLat", "35.100000");
    formData.set("maxLng", "126.100000");

    const params = searchParamsWithCurrentLocationState(
      "?lat=36.330000&lng=127.440000&minLat=36.300000&minLng=127.400000&maxLat=36.360000&maxLng=127.480000&page=2",
      formData
    );

    expect(Object.fromEntries(params.entries())).toEqual({
      lat: "36.330000",
      lng: "127.440000",
      maxLat: "36.360000",
      maxLng: "127.480000",
      minLat: "36.300000",
      minLng: "127.400000",
      limit: "30",
      nursing: "on",
      query: "수유실",
      sort: "recommended"
    });
    expect(params.has("page")).toBe(false);
  });

  it("uses form location inputs when there is no current location state", () => {
    const formData = new FormData();
    formData.set("lat", "36.330000");
    formData.set("lng", "127.440000");
    formData.set("radiusKm", "20");
    formData.set("nearby", "1");
    formData.set("stroller", "on");

    expect(Object.fromEntries(searchParamsWithCurrentLocationState("", formData).entries())).toEqual({
      lat: "36.330000",
      lng: "127.440000",
      nearby: "1",
      radiusKm: "20",
      stroller: "on"
    });
  });
});
