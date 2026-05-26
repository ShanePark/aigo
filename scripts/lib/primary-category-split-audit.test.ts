import { describe, expect, it } from "vitest";

import { emptyPlaceTaxonomy } from "@/lib/taxonomy";
import { buildPrimaryCategorySplitAudit, suggestPrimaryCategorySplit, type PrimaryCategorySplitAuditRow } from "./primary-category-split-audit";

describe("suggestPrimaryCategorySplit", () => {
  it("suggests playground when park rows have play equipment evidence", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "park",
        name: "햇살어린이공원",
        play_features: { slide: true, swing: "yes" }
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("playground");
    expect(suggestion.confidence).toBe("high");
    expect(suggestion.evidence).toEqual(expect.arrayContaining(["playFeatures:slide", "playFeatures:swing"]));
  });

  it("keeps broad park rows as park when playground evidence is absent", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "park",
        name: "대청호 자연생태공원",
        description: "호수 산책과 자연 관찰 중심의 넓은 공원"
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("park");
    expect(suggestion.reasonCodes).toContain("NO_PLAYGROUND_EVIDENCE");
  });

  it("keeps broad park rows as park when playground evidence only appears in context", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "park",
        name: "거제식물원",
        taxonomy: taxonomyWithActivity("outdoor_playground")
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("park");
    expect(suggestion.confidence).toBe("medium");
    expect(suggestion.reasonCodes).toContain("BROAD_PARK_PLAYGROUND_CONTEXT_ONLY");
    expect(suggestion.evidence).toContain("taxonomy.activityTypes:outdoor_playground");
  });

  it("keeps named parks as park when playground terms are not part of the place name", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "park",
        name: "가오근린공원",
        description: "공원 안에 물놀이터와 미끄럼틀이 있다.",
        play_features: { waterPlayground: "yes" }
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("park");
    expect(suggestion.reasonCodes).toContain("BROAD_PARK_PLAYGROUND_CONTEXT_ONLY");
  });

  it("still suggests playground when a broad park name explicitly names a playground facility", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "park",
        name: "국립중앙과학관 어린이 과학놀이터",
        taxonomy: taxonomyWithActivity("outdoor_playground")
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("playground");
    expect(suggestion.confidence).toBe("high");
  });

  it("splits art museums from generic museum rows", () => {
    const suggestion = suggestPrimaryCategorySplit(row({ primary_category: "museum", name: "대전시립미술관" }));

    expect(suggestion.suggestedPrimaryCategory).toBe("art_museum");
    expect(suggestion.confidence).toBe("high");
  });

  it("keeps generic museum rows when art evidence only appears outside the name", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "museum",
        name: "목포자연사박물관",
        description: "주변 미술관과 함께 방문할 수 있는 자연사 중심 박물관"
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("museum");
    expect(suggestion.reasonCodes).toContain("ART_MUSEUM_CONTEXT_ONLY");
  });
});

describe("buildPrimaryCategorySplitAudit", () => {
  it("summarizes current and suggested category counts", () => {
    const audit = buildPrimaryCategorySplitAudit(
      [
        row({ primary_category: "museum", name: "대전시립미술관" }),
        row({ primary_category: "park", name: "대청호 자연생태공원" })
      ],
      "2026-05-26T00:00:00.000Z"
    );

    expect(audit.generatedAt).toBe("2026-05-26T00:00:00.000Z");
    expect(audit.countsByCurrentCategory).toEqual({ museum: 1, park: 1 });
    expect(audit.countsBySuggestion).toEqual({ art_museum: 1, park: 1 });
  });
});

function row(overrides: Partial<PrimaryCategorySplitAuditRow>): PrimaryCategorySplitAuditRow {
  return {
    id: "place-1",
    name: "테스트 장소",
    primary_category: "park",
    tags: [],
    description: null,
    parent_notes: null,
    safety_notes: null,
    play_features: {},
    taxonomy: null,
    region_sido: "대전광역시",
    region_sigungu: "중구",
    address: "대전 중구",
    road_address: null,
    ...overrides
  };
}

function taxonomyWithActivity(activityType: "outdoor_playground") {
  const taxonomy = emptyPlaceTaxonomy();
  taxonomy.sourceBacked.activityTypes = [activityType];
  return taxonomy;
}
