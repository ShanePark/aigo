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
    expect(shouldFallbackToAllCategoriesForQuery("대전역 장난감 가게", "toyStore")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("레고 스토어 주차", "toyStore")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("장난감도서관", "visit")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("백화점 수유실", "shopping")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("쇼핑몰 베이비라운지", "shopping")).toBe(false);
    expect(shouldFallbackToAllCategoriesForQuery("미끄럼틀 있는 놀이터", "playground")).toBe(false);
  });

  it("falls back when the typed category contradicts the active tab", () => {
    expect(shouldFallbackToAllCategoriesForQuery("공원", "kidsCafe")).toBe(true);
    expect(shouldFallbackToAllCategoriesForQuery("공원 산책", "playground")).toBe(true);
    expect(shouldFallbackToAllCategoriesForQuery("백화점 수유실", "visit")).toBe(true);
    expect(shouldFallbackToAllCategoriesForQuery("레고 스토어 주차", "visit")).toBe(true);
  });

  it("does not fall back for all-category searches", () => {
    expect(shouldFallbackToAllCategoriesForQuery("논산", "all")).toBe(false);
  });
});
