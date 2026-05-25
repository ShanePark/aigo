import { describe, expect, it } from "vitest";

import { buildPatchPayload, parseArgs, selectPatchCandidates } from "./apply-primary-category-splits";
import type { PrimaryCategorySplitAudit } from "./lib/primary-category-split-audit";

describe("parseArgs", () => {
  it("parses dry-run filters", () => {
    expect(parseArgs(["--json", "--category=park", "--limit=10", "--min-confidence=medium"])).toEqual({
      apply: false,
      json: true,
      category: "park",
      limit: 10,
      minConfidence: "medium"
    });
  });

  it("rejects unsupported categories", () => {
    expect(() => parseArgs(["--category=kids_cafe"])).toThrow(/Unsupported --category=kids_cafe/);
  });
});

describe("selectPatchCandidates", () => {
  it("selects changed high-confidence suggestions by default", () => {
    const candidates = selectPatchCandidates(audit(), { minConfidence: "high" });

    expect(candidates.map((candidate) => candidate.name)).toEqual(["명백한 아쿠아리움"]);
  });

  it("can include medium-confidence changed suggestions", () => {
    const candidates = selectPatchCandidates(audit(), { minConfidence: "medium" });

    expect(candidates.map((candidate) => candidate.name)).toEqual(["명백한 아쿠아리움", "중간 신뢰 놀이터"]);
  });
});

describe("buildPatchPayload", () => {
  it("builds an API update payload with an audit source", () => {
    const payload = buildPatchPayload(
      {
        id: "place-1",
        name: "명백한 아쿠아리움",
        currentPrimaryCategory: "aquarium_zoo",
        suggestedPrimaryCategory: "aquarium",
        confidence: "high",
        reasonCodes: ["AQUARIUM_TERM_MATCH"],
        evidence: ["aquarium:아쿠아리움"]
      },
      "2026-05-26T00:00:00.000+09:00"
    );

    expect(payload.primaryCategory).toBe("aquarium");
    expect(payload.sourceMode).toBe("append");
    expect(payload.changeSummary).toContain("aquarium_zoo to aquarium");
    expect(payload.sources[0]).toMatchObject({
      sourceType: "agent_observation",
      title: "AiGo primaryCategory split audit",
      externalId: "primary-category-split:place-1:2026-05-26",
      checkedAt: "2026-05-26T00:00:00.000+09:00"
    });
  });
});

function audit(): PrimaryCategorySplitAudit {
  return {
    generatedAt: "2026-05-26T00:00:00.000+09:00",
    total: 4,
    countsByCurrentCategory: { aquarium_zoo: 2, park: 1, museum: 1 },
    countsBySuggestion: { aquarium: 1, playground: 1, museum: 1, needs_review: 1 },
    items: [
      {
        id: "place-1",
        name: "명백한 아쿠아리움",
        currentPrimaryCategory: "aquarium_zoo",
        suggestedPrimaryCategory: "aquarium",
        confidence: "high",
        reasonCodes: ["AQUARIUM_TERM_MATCH"],
        evidence: ["aquarium:아쿠아리움"],
        region: "부산광역시 해운대구",
        address: "부산 해운대구"
      },
      {
        id: "place-2",
        name: "중간 신뢰 놀이터",
        currentPrimaryCategory: "park",
        suggestedPrimaryCategory: "playground",
        confidence: "medium",
        reasonCodes: ["PLAYGROUND_EVIDENCE"],
        evidence: ["playground:놀이터"],
        region: "대전광역시 유성구",
        address: "대전 유성구"
      },
      {
        id: "place-3",
        name: "그대로 박물관",
        currentPrimaryCategory: "museum",
        suggestedPrimaryCategory: "museum",
        confidence: "medium",
        reasonCodes: ["NO_ART_MUSEUM_EVIDENCE"],
        evidence: [],
        region: null,
        address: null
      },
      {
        id: "place-4",
        name: "검토 필요 복합시설",
        currentPrimaryCategory: "aquarium_zoo",
        suggestedPrimaryCategory: "needs_review",
        confidence: "low",
        reasonCodes: ["MIXED_AQUARIUM_ZOO_EVIDENCE"],
        evidence: [],
        region: null,
        address: null
      }
    ]
  };
}
