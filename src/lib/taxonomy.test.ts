import { describe, expect, it } from "vitest";

import { inferTaxonomyFromPlace, inferTaxonomySearchFacets, normalizeLegacyTags, normalizeRegionSido, normalizeSourceType, primaryCategories } from "@/lib/taxonomy";

describe("taxonomy catalog", () => {
  it("keeps primary categories as a closed top-level set", () => {
    expect(primaryCategories).toContain("kids_cafe");
    expect(primaryCategories).toContain("accommodation");
    expect(primaryCategories).not.toContain("playground");
  });

  it("canonicalizes source type and region aliases", () => {
    expect(normalizeSourceType("official_page")).toBe("official_site");
    expect(normalizeSourceType("public_data_mirror")).toBe("public_agency");
    expect(normalizeSourceType("blog")).toBe("public_blog");
    expect(normalizeSourceType("official_library_image_source")).toBe("official_image_source");
    expect(normalizeSourceType("made_up_source")).toBeNull();
    expect(normalizeRegionSido("대전")).toBe("대전광역시");
    expect(normalizeRegionSido("충남")).toBe("충청남도");
  });

  it("maps legacy tags while preserving unmapped audit values", () => {
    const normalized = normalizeLegacyTags(["모래놀이", "parking", "unknown-local-tag"]);

    expect(normalized.facets.activityTypes).toEqual(["sand_play"]);
    expect(normalized.facets.logisticsTags).toEqual(["parking"]);
    expect(normalized.broadMappedTags).toEqual(["모래놀이", "parking"]);
    expect(normalized.unmappedTags).toEqual(["unknown-local-tag"]);
  });

  it("infers place taxonomy facets from current place fields", () => {
    const inferred = inferTaxonomyFromPlace({
      primaryCategory: "rest_area",
      tags: ["주말당일"],
      strollerFriendly: "yes",
      nursingRoom: "partial",
      diaperChangingTable: "unknown",
      parkingAvailable: "yes"
    });

    expect(inferred.familyFitGates).toContain("route_break");
    expect(inferred.visitUseCases).toContain("day_trip");
    expect(inferred.logisticsTags).toEqual(expect.arrayContaining(["stroller", "nursing_room", "parking"]));
  });

  it("infers Korean parent query facets for future search wiring", () => {
    const facets = inferTaxonomySearchFacets("쌍둥이 유모차로 비오는날 모래놀이터 가는 길");

    expect(facets.activityTypes).toContain("sand_play");
    expect(facets.familyFitGates).toEqual(expect.arrayContaining(["baby_logistics", "route_break"]));
    expect(facets.visitUseCases).toEqual(expect.arrayContaining(["rainy_day", "day_trip"]));
    expect(facets.logisticsTags).toEqual(expect.arrayContaining(["double_stroller", "nursing_room", "diaper_table"]));
  });
});
