import { describe, expect, it } from "vitest";

import { shouldFallbackToAllCategoriesForQuery } from "@/lib/search-intent";

describe("search intent helpers", () => {
  it("falls back from stale category tabs for place and region lookups", () => {
    expect(shouldFallbackToAllCategoriesForQuery("논산", "kidsCafe")).toBe(true);
    expect(shouldFallbackToAllCategoriesForQuery("연산역", "kidsCafe")).toBe(true);
  });

  it("keeps a category tab when the query asks for that category", () => {
    expect(shouldFallbackToAllCategoriesForQuery("논산 키즈카페", "kidsCafe")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("키즈카페", "kidsCafe")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("대전역 장난감 가게", "visit")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("레고 스토어 주차", "visit")).toBe(false);
  });

  it("falls back when the typed category contradicts the active tab", () => {
    expect(shouldFallbackToAllCategoriesForQuery("공원", "kidsCafe")).toBe(true);
  });

  it("does not fall back for all-category searches", () => {
    expect(shouldFallbackToAllCategoriesForQuery("논산", "all")).toBe(false);
  });
});
