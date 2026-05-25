import { describe, expect, it } from "vitest";

import { buildCandidateAudit, formatRegionCandidateAuditReport, latestVersionSummary, parseArgs, sourceFreshnessFromDetail } from "./audit-region-candidates";

type PlaceAuditSummaryInput = Parameters<typeof buildCandidateAudit>[0]["exactMatches"][number];
type DuplicateAuditSummaryInput = Parameters<typeof buildCandidateAudit>[0]["duplicateCandidates"][number];

function place(overrides: Partial<PlaceAuditSummaryInput> = {}): PlaceAuditSummaryInput {
  return {
    id: "place-1",
    name: "스타필드 시티 부천",
    primaryCategory: "shopping_mall",
    address: "경기 부천시 옥길로 1",
    roadAddress: "경기 부천시 옥길로 1",
    updatedAt: "2026-05-01T00:00:00.000Z",
    sourceFreshness: {
      sourceCount: 2,
      latestCheckedAt: "2026-05-01T00:00:00.000Z",
      latestCreatedAt: "2026-04-20T00:00:00.000Z",
      freshestAt: "2026-05-01T00:00:00.000Z",
      daysSinceFreshest: 23,
      stale: false
    },
    latestVersion: {
      versionNumber: 3,
      action: "update",
      changeSummary: "Updated public family logistics.",
      createdAt: "2026-05-01T00:00:00.000Z"
    },
    imageHealth: {
      status: "healthy",
      suggestedAction: "none",
      activeCount: 4,
      approvedCount: 4,
      needsReviewCount: 0,
      pendingReviewCount: 0,
      hasPrimary: true
    },
    ...overrides
  };
}

function duplicate(overrides: Partial<DuplicateAuditSummaryInput> = {}): DuplicateAuditSummaryInput {
  return {
    id: "dup-1",
    name: "스타필드시티 부천",
    primaryCategory: "shopping_mall",
    address: "경기 부천시 옥길로 1",
    roadAddress: "경기 부천시 옥길로 1",
    confidence: "high",
    reasonCodes: ["ALIAS_MATCH", "REGION_MATCH"],
    suggestedAction: "update_existing",
    outsideRadiusReviewOnly: false,
    distanceMeters: null,
    ...overrides
  };
}

describe("region candidate audit helper", () => {
  it("parses region hints and repeated candidates", () => {
    const args = parseArgs([
      "--region=부천시",
      "--region-sido=경기",
      "--candidate=스타필드 시티 부천",
      "--candidates=웅진플레이도시,부천자연생태공원",
      "--duplicate-limit=7",
      "--healthcheck-name=스타필드 시티 부천",
      "--healthcheck-place-id=place-starfield",
      "--skip-healthcheck",
      "--stale-after-days=90",
      "--json"
    ]);

    expect(args.region).toBe("부천시");
    expect(args.regionSido).toBe("경기");
    expect(args.candidates).toEqual(["스타필드 시티 부천", "웅진플레이도시", "부천자연생태공원"]);
    expect(args.duplicateLimit).toBe(7);
    expect(args.healthcheckName).toBe("스타필드 시티 부천");
    expect(args.healthcheckPlaceId).toBe("place-starfield");
    expect(args.skipHealthcheck).toBe(true);
    expect(args.staleAfterDays).toBe(90);
    expect(args.json).toBe(true);
  });

  it("computes source freshness from checkedAt before createdAt", () => {
    const freshness = sourceFreshnessFromDetail(
      {
        sources: [
          { checkedAt: "2026-05-20T00:00:00.000Z", createdAt: "2026-05-01T00:00:00.000Z" },
          { createdAt: "2026-05-22T00:00:00.000Z" }
        ]
      },
      new Date("2026-05-24T00:00:00.000Z"),
      30
    );

    expect(freshness).toEqual({
      sourceCount: 2,
      latestCheckedAt: "2026-05-20T00:00:00.000Z",
      latestCreatedAt: "2026-05-22T00:00:00.000Z",
      freshestAt: "2026-05-20T00:00:00.000Z",
      daysSinceFreshest: 4,
      stale: false
    });
  });

  it("marks exact matches with stale sources or image gaps as update-ready", () => {
    const audit = buildCandidateAudit({
      query: "롯데프리미엄아울렛 의왕점",
      region: "의왕시",
      exactSearchCount: 1,
      exactMatches: [
        place({
          name: "롯데프리미엄아울렛 의왕점",
          sourceFreshness: { ...place().sourceFreshness, stale: true },
          imageHealth: { ...place().imageHealth!, status: "no_primary", hasPrimary: false }
        })
      ],
      duplicateCandidates: []
    });

    expect(audit.status).toBe("needs_update");
    expect(audit.suggestedAction).toBe("update_existing");
  });

  it("marks missing candidates with strong duplicate matches for manual review", () => {
    const audit = buildCandidateAudit({
      query: "스타필드시티 부천",
      region: "부천시",
      exactSearchCount: 0,
      exactMatches: [],
      duplicateCandidates: [duplicate()]
    });

    expect(audit.status).toBe("duplicate_review");
    expect(audit.suggestedAction).toBe("manual_duplicate_review");
  });

  it("holds review-only duplicate candidates for manual review instead of creation", () => {
    const audit = buildCandidateAudit({
      query: "서울식물원 어린이자료실",
      region: "서울",
      exactSearchCount: 0,
      exactMatches: [],
      duplicateCandidates: [
        duplicate({
          confidence: "low",
          reasonCodes: ["ALIAS_MATCH", "GEO_OUTSIDE_REQUEST_RADIUS", "OUTSIDE_RADIUS_REVIEW_ONLY"],
          suggestedAction: "hold_duplicate_review",
          outsideRadiusReviewOnly: true,
          distanceMeters: 12000
        })
      ]
    });

    expect(audit.status).toBe("duplicate_review");
    expect(audit.suggestedAction).toBe("manual_duplicate_review");
  });

  it("extracts the latest version by version number", () => {
    const latest = latestVersionSummary({
      items: [
        { versionNumber: 1, action: "create", changeSummary: "Created", createdAt: "2026-05-01T00:00:00.000Z" },
        { versionNumber: 3, action: "update", changeSummary: "Added sources", createdAt: "2026-05-03T00:00:00.000Z" },
        { versionNumber: 2, action: "update", changeSummary: "Added images", createdAt: "2026-05-02T00:00:00.000Z" }
      ]
    });

    expect(latest).toMatchObject({
      versionNumber: 3,
      action: "update",
      changeSummary: "Added sources"
    });
  });

  it("formats source freshness, image health, and duplicate signals", () => {
    const audit = buildCandidateAudit({
      query: "스타필드 시티 부천",
      region: "부천시",
      exactSearchCount: 1,
      exactMatches: [place()],
      duplicateCandidates: [duplicate()]
    });

    const formatted = formatRegionCandidateAuditReport({
      region: "부천시",
      generatedAt: "2026-05-24T00:00:00.000Z",
      candidates: [audit]
    });

    expect(formatted).toContain("source: 2026-05-01T00:00:00.000Z fresh");
    expect(formatted).toContain("image: healthy");
    expect(formatted).toContain("duplicate candidates:");
    expect(formatted).toContain("action=update_existing");
    expect(formatted).toContain("ALIAS_MATCH");
  });
});
