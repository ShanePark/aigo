import { describe, expect, it } from "vitest";

import { KOREA_REGIONS, REGION_MAJOR_CATEGORIES, regionBySlug } from "@/app/regions/region-catalog";

describe("region catalog", () => {
  it("defines the 17 Korean province-level regions with image metadata", () => {
    expect(KOREA_REGIONS).toHaveLength(17);
    expect(new Set(KOREA_REGIONS.map((region) => region.slug)).size).toBe(17);

    for (const region of KOREA_REGIONS) {
      expect(region.label).toBeTruthy();
      expect(region.regionSido).toBeTruthy();
      expect(region.imageSrc).toBe(`/images/regions/${region.slug}.webp`);
      expect(region.mapPosition.x).toBeGreaterThanOrEqual(0);
      expect(region.mapPosition.x).toBeLessThanOrEqual(100);
      expect(region.mapPosition.y).toBeGreaterThanOrEqual(0);
      expect(region.mapPosition.y).toBeLessThanOrEqual(100);
    }
  });

  it("keeps representative region browsing focused on major destination categories", () => {
    expect(REGION_MAJOR_CATEGORIES).toEqual([
      "zoo",
      "aquarium",
      "museum",
      "science_museum",
      "art_museum",
      "experience_center",
      "shopping_mall",
      "accommodation",
      "library"
    ]);
  });

  it("falls back to Seoul for unknown region slugs", () => {
    expect(regionBySlug("jeju").regionSido).toBe("제주특별자치도");
    expect(regionBySlug("missing").regionSido).toBe("서울특별시");
  });
});
