import { describe, expect, it } from "vitest";

import { buildPrimaryCategorySplitAudit, suggestPrimaryCategorySplit, type PrimaryCategorySplitAuditRow } from "./primary-category-split-audit";

describe("suggestPrimaryCategorySplit", () => {
  it("splits aquarium_zoo rows with aquarium evidence", () => {
    const suggestion = suggestPrimaryCategorySplit(row({ primary_category: "aquarium_zoo", name: "대전아쿠아리움" }));

    expect(suggestion.suggestedPrimaryCategory).toBe("aquarium");
    expect(suggestion.confidence).toBe("high");
    expect(suggestion.reasonCodes).toContain("AQUARIUM_TERM_MATCH");
  });

  it("does not treat legacy aquarium_zoo tags as standalone zoo evidence", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "aquarium_zoo",
        name: "경포 아쿠아리움",
        tags: ["aquarium_zoo"]
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("aquarium");
    expect(suggestion.reasonCodes).not.toContain("MIXED_AQUARIUM_ZOO_EVIDENCE");
  });

  it("treats Korean aquarium brand terms as high-confidence aquarium evidence", () => {
    const suggestions = [
      suggestPrimaryCategorySplit(row({ primary_category: "aquarium_zoo", name: "아쿠아플라넷 광교" })),
      suggestPrimaryCategorySplit(row({ primary_category: "aquarium_zoo", name: "싱가포르 오셔너리움" }))
    ];

    expect(suggestions.map((suggestion) => suggestion.suggestedPrimaryCategory)).toEqual(["aquarium", "aquarium"]);
    expect(suggestions.map((suggestion) => suggestion.confidence)).toEqual(["high", "high"]);
  });

  it("splits aquarium_zoo rows with zoo evidence", () => {
    const suggestion = suggestPrimaryCategorySplit(row({ primary_category: "aquarium_zoo", name: "서울동물원" }));

    expect(suggestion.suggestedPrimaryCategory).toBe("zoo");
    expect(suggestion.confidence).toBe("high");
    expect(suggestion.reasonCodes).toContain("ZOO_TERM_MATCH");
  });

  it("keeps mixed aquarium and zoo rows for manual review", () => {
    const suggestion = suggestPrimaryCategorySplit(
      row({
        primary_category: "aquarium_zoo",
        name: "가족 생태관",
        tags: ["아쿠아리움", "동물원"]
      })
    );

    expect(suggestion.suggestedPrimaryCategory).toBe("needs_review");
    expect(suggestion.reasonCodes).toContain("MIXED_AQUARIUM_ZOO_EVIDENCE");
  });

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

  it("splits art museums from generic museum rows", () => {
    const suggestion = suggestPrimaryCategorySplit(row({ primary_category: "museum", name: "대전시립미술관" }));

    expect(suggestion.suggestedPrimaryCategory).toBe("art_museum");
    expect(suggestion.confidence).toBe("high");
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
