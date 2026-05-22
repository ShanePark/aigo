import { describe, expect, it } from "vitest";

import { createPlaceSchema, searchPlacesSchema, updatePlaceSchema } from "@/lib/schemas";

describe("place schemas", () => {
  it("requires coordinates and at least one source when creating a place", () => {
    const result = createPlaceSchema.safeParse({
      name: "테스트 장소",
      primaryCategory: "indoor_playground",
      address: "대전",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects accommodation in MVP", () => {
    const result = createPlaceSchema.safeParse({
      name: "테스트 숙소",
      primaryCategory: "accommodation",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.success).toBe(false);
  });

  it("defaults search pagination and keeps facility preferences soft", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      preferences: {
        strollerFriendly: true,
        foodAllowed: true
      }
    });

    expect(result.limit).toBe(20);
    expect(result.radiusKm).toBe(80);
    expect(result.preferences?.strollerFriendly).toBe(true);
    expect(result.preferences?.foodAllowed).toBe(true);
  });

  it("accepts common agent aliases for search location and child ages", () => {
    const result = searchPlacesSchema.parse({
      location: { lat: 36.35, lng: 127.38, label: "대전역" },
      childAgesMonths: [32, 7, 7]
    });

    expect(result.origin).toEqual({ lat: 36.35, lng: 127.38, label: "대전역" });
    expect(result.childAgeMonths).toEqual([32, 7, 7]);
  });

  it("defaults update source mode to append and accepts replace", () => {
    const append = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });
    const replace = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com" }],
      sourceMode: "replace"
    });

    expect(append.sourceMode).toBe("append");
    expect(replace.sourceMode).toBe("replace");
  });

  it("accepts structured image entities for visual audit metadata", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }],
      imageMode: "replace",
      images: [
        {
          url: "https://example.com/place.jpg",
          sourceUrl: "https://example.com/place",
          sourceType: "official_image_source",
          sourceTitle: "공식 대표 사진",
          description: "실내 놀이 공간과 낮은 미끄럼틀이 보이는 대표 사진.",
          visualFeatures: ["indoor_play", "slide"],
          childSignals: { slide: true, swing: false },
          displayTier: "official",
          reviewStatus: "approved",
          isPrimary: true
        }
      ]
    });

    expect(result.imageMode).toBe("replace");
    expect(result.images?.[0]).toMatchObject({
      displayTier: "official",
      reviewStatus: "approved",
      visualFeatures: ["indoor_play", "slide"],
      childSignals: { slide: true, swing: false }
    });
  });
});
