import { describe, expect, it } from "vitest";

import { auditRegions, formatMarkdown } from "./audit-taxonomy";

describe("taxonomy audit helpers", () => {
  it("reports raw and normalized region distributions together", () => {
    const result = auditRegions([
      { region_sido: "부산" },
      { region_sido: "부산광역시" },
      { region_sido: "충북" },
      { region_sido: "강원특별자치도특별자치도" },
      { region_sido: null }
    ]);

    expect(result.distribution).toMatchObject({
      부산: 1,
      부산광역시: 1,
      충북: 1,
      강원특별자치도특별자치도: 1,
      unknown: 1
    });
    expect(result.normalizedDistribution).toMatchObject({
      부산광역시: 2,
      충청북도: 1,
      강원특별자치도: 1,
      unknown: 1
    });
    expect(result.aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ region: "부산", canonical: "부산광역시", count: 1 }),
        expect.objectContaining({ region: "충북", canonical: "충청북도", count: 1 }),
        expect.objectContaining({
          region: "강원특별자치도특별자치도",
          canonical: "강원특별자치도",
          count: 1
        })
      ])
    );
    expect(result.unknown).toEqual([]);
  });

  it("renders raw and normalized region sections in markdown", () => {
    const regions = auditRegions([{ region_sido: "부산" }, { region_sido: "부산광역시" }]);

    const markdown = formatMarkdown({
      generatedAt: "2026-05-25T00:00:00.000Z",
      filters: { category: null },
      placeCount: 2,
      primaryCategories: {
        distribution: {},
        invalid: [],
        canonicalMissing: []
      },
      tags: {
        uniqueCount: 0,
        singletonCount: 0,
        processLikeCount: 0,
        processLikeExamples: [],
        top: []
      },
      sourceTypes: {
        distribution: {},
        aliases: [],
        unknown: [],
        canonicalMissing: []
      },
      regions,
      taxonomy: {
        withTaxonomy: 0,
        sourceBacked: emptyFacetCountMap(),
        inferred: emptyFacetCountMap(),
        migration: {
          broadMappedExamples: [],
          unmappedExamples: []
        }
      }
    });

    expect(markdown).toContain("Raw distribution:");
    expect(markdown).toContain("- 부산: 1");
    expect(markdown).toContain("Normalized distribution:");
    expect(markdown).toContain("- 부산광역시: 2");
  });
});

function emptyFacetCountMap() {
  return {
    familyFitGates: {},
    activityTypes: {},
    visitUseCases: {},
    ageBands: {},
    logisticsTags: {},
    riskTags: {}
  };
}
