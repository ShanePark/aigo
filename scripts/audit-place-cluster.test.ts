import { describe, expect, it } from "vitest";

import { buildClusterAuditReport, buildPairAudit, formatClusterAuditReport, parseArgs } from "./audit-place-cluster";

type AuditPlaceInput = Parameters<typeof buildPairAudit>[0];

function place(overrides: Partial<AuditPlaceInput> = {}): AuditPlaceInput {
  return {
    id: "place-1",
    query: "부천자연생태공원",
    name: "부천자연생태공원",
    primaryCategory: "park",
    address: "경기 부천시 길주로 660",
    roadAddress: "경기 부천시 길주로 660",
    lat: 37.505,
    lng: 126.813,
    officialUrl: "https://example.go.kr/eco",
    sourceHosts: ["example.go.kr"],
    sourceHierarchyKeys: ["example.go.kr/eco"],
    relatedPlaceIds: [],
    ...overrides
  };
}

describe("place cluster audit helper", () => {
  it("parses repeated and comma-separated candidates", () => {
    const args = parseArgs([
      "--candidate=부천자연생태공원",
      "--candidates=자연생태박물관,무릉도원수목원",
      "--same-site-meters=500",
      "--nearby-meters=1500",
      "--json"
    ]);

    expect(args.candidates).toEqual(["부천자연생태공원", "자연생태박물관", "무릉도원수목원"]);
    expect(args.sameSiteMeters).toBe(500);
    expect(args.nearbyMeters).toBe(1500);
    expect(args.json).toBe(true);
  });

  it("suggests same_site for places with the same official address", () => {
    const pair = buildPairAudit(
      place({ id: "parent", name: "부천자연생태공원" }),
      place({ id: "garden", query: "부천식물원", name: "부천식물원", lat: 37.5052, lng: 126.8131 }),
      { sameSiteMeters: 350, nearbyMeters: 1_000 }
    );

    expect(pair.relationSuggestion).toBe("same_site");
    expect(pair.confidence).toBe("high");
    expect(pair.patchDraft?.relatedPlaces[0]).toMatchObject({
      placeId: "garden",
      relationType: "same_site"
    });
  });

  it("suggests parent_child when one name contains the other", () => {
    const pair = buildPairAudit(
      place({ id: "parent", name: "어린이식품안전체험관" }),
      place({ id: "child", name: "경기도 어린이식품안전체험관 부천센터", address: null, roadAddress: null, lat: null, lng: null }),
      { sameSiteMeters: 350, nearbyMeters: 1_000 }
    );

    expect(pair.relationSuggestion).toBe("parent_child");
    expect(pair.confidence).toBe("high");
    expect(pair.evidence.nestedName).toBe(true);
  });

  it("does not draft a patch when the relationship already exists", () => {
    const pair = buildPairAudit(
      place({ id: "park", relatedPlaceIds: ["museum"] }),
      place({ id: "museum", query: "자연생태박물관", name: "자연생태박물관" }),
      { sameSiteMeters: 350, nearbyMeters: 1_000 }
    );

    expect(pair.relationSuggestion).toBe("already_related");
    expect(pair.patchDraft).toBeNull();
  });

  it("builds a report with review-only patch drafts", () => {
    const report = buildClusterAuditReport(
      [
        { query: "부천자연생태공원", status: "found", searchCount: 1, places: [place({ id: "park" })] },
        { query: "부천식물원", status: "found", searchCount: 1, places: [place({ id: "garden", query: "부천식물원", name: "부천식물원" })] }
      ],
      { sameSiteMeters: 350, nearbyMeters: 1_000 }
    );

    expect(report.pairs).toHaveLength(1);
    expect(report.patchDrafts).toHaveLength(1);
    expect(formatClusterAuditReport(report)).toContain("Review-only PATCH drafts:");
  });
});
