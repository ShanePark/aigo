import { describe, expect, it } from "vitest";

import {
  clearMapLocationParamsForTextSearch,
  hasMapLocationParams,
  searchParamsForCurrentLocation,
  searchParamsRecordFromURLSearchParams,
  searchParamsForViewportSearch,
  searchParamsWithCurrentLocationState
} from "@/app/search-url-state";

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
    formData.append("categoryGroups", "shopping");
    formData.append("categoryGroups", "visit");
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
      categoryGroups: "visit",
      nursing: "on",
      query: "수유실",
      sort: "recommended"
    });
    expect(params.getAll("categoryGroups")).toEqual(["shopping", "visit"]);
    expect(params.has("page")).toBe(false);
  });

  it("keeps current map state for facet changes even after text-search form data cleanup", () => {
    const formData = new FormData();
    formData.set("query", "수유실");
    formData.set("sort", "recommended");
    formData.set("limit", "30");
    formData.set("nursing", "on");
    formData.set("lat", "35.000000");
    formData.set("lng", "126.000000");
    formData.set("minLat", "35.000000");
    formData.set("minLng", "126.000000");
    formData.set("maxLat", "35.100000");
    formData.set("maxLng", "126.100000");

    clearMapLocationParamsForTextSearch(formData);
    const params = searchParamsWithCurrentLocationState(
      "?lat=36.330000&lng=127.440000&minLat=36.300000&minLng=127.400000&maxLat=36.360000&maxLng=127.480000",
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

  it("builds current-location state without keeping stale viewport or paging params", () => {
    expect(
      searchParamsForCurrentLocation(
        {
          categoryGroup: "playground",
          maxLat: "36.400000",
          maxLng: "127.500000",
          minLat: "36.300000",
          minLng: "127.400000",
          page: "3",
          parking: "on",
          query: "모래놀이",
          sort: "recommended"
        },
        { lat: 37.5665, lng: 126.978 },
        { sort: "recommended" }
      )
    ).toEqual({
      categoryGroup: "playground",
      lat: "37.566500",
      lng: "126.978000",
      nearby: "1",
      parking: "on",
      query: "모래놀이",
      sort: "recommended"
    });
  });

  it("detects map location params", () => {
    expect(hasMapLocationParams({ query: "키즈카페" })).toBe(false);
    expect(hasMapLocationParams({ lat: "37.566500" })).toBe(true);
    expect(hasMapLocationParams({ maxLat: ["", "37.600000"] })).toBe(true);
  });

  it("converts URLSearchParams to the client search event record shape", () => {
    const params = new URLSearchParams();
    params.set("query", "아이랑 실내");
    params.append("category", "kids_cafe");
    params.append("category", "library");
    params.set("children", "boy:12-24,girl:0-6");
    params.set("empty", " ");

    expect(searchParamsRecordFromURLSearchParams(params)).toEqual({
      category: ["kids_cafe", "library"],
      children: "boy:12-24,girl:0-6",
      query: "아이랑 실내"
    });
  });

  it("clears carried map location params for an explicit text search", () => {
    const params = new URLSearchParams({
      categoryGroup: "kidsCafe",
      lat: "36.330000",
      lng: "127.440000",
      maxLat: "36.360000",
      maxLng: "127.480000",
      minLat: "36.300000",
      minLng: "127.400000",
      nearby: "1",
      query: "서울 키즈카페",
      radiusKm: "20",
      sort: "distance"
    });

    clearMapLocationParamsForTextSearch(params);

    expect(Object.fromEntries(params.entries())).toEqual({
      categoryGroup: "kidsCafe",
      query: "서울 키즈카페",
      sort: "distance"
    });
  });

  it("keeps map location params when the text query is blank", () => {
    const params = new URLSearchParams({
      lat: "36.330000",
      lng: "127.440000",
      query: "   ",
      radiusKm: "20"
    });

    clearMapLocationParamsForTextSearch(params);

    expect(Object.fromEntries(params.entries())).toEqual({
      lat: "36.330000",
      lng: "127.440000",
      query: "   ",
      radiusKm: "20"
    });
  });
});
