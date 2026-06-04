import { describe, expect, it } from "vitest";

import { buildRetirePairPlan, buildTransferPlan, parseArgs, parseRetirePair } from "./plan-active-duplicate-retire";

describe("active duplicate retire planning", () => {
  it("parses keep/retire pairs", () => {
    expect(parseRetirePair("keep-1:retire-1")).toEqual({ keepId: "keep-1", retireId: "retire-1" });
    expect(() => parseRetirePair("same:same")).toThrow(/differ/);
  });

  it("parses CLI args", () => {
    const args = parseArgs(["--skip-healthcheck", "--json", "--pair=keep-1:retire-1", "--timeout-ms=5000"]);

    expect(args.skipHealthcheck).toBe(true);
    expect(args.json).toBe(true);
    expect(args.timeoutMs).toBe(5000);
    expect(args.pairs).toEqual([{ keepId: "keep-1", retireId: "retire-1" }]);
  });

  it("builds transfer plan for aliases, sources, and image review", () => {
    const plan = buildTransferPlan(
      {
        id: "keep-1",
        name: "이월드",
        status: "active",
        address: "대구 달서구 두류공원로 200",
        roadAddress: null,
        lat: 35.853,
        lng: 128.563,
        aliases: ["이월드"],
        sources: [{ sourceType: "official_site", title: "이월드", url: "https://example.test/keep" }],
        imageCount: 1,
        latestVersion: null
      },
      {
        id: "retire-1",
        name: "이월드",
        status: "active",
        address: "대구 달서구 두류공원로 200",
        roadAddress: null,
        lat: 35.853,
        lng: 128.563,
        aliases: ["E-World", "이월드"],
        sources: [
          { sourceType: "official_site", title: "이월드", url: "https://example.test/keep" },
          { sourceType: "public_listing", title: "목록", url: "https://example.test/listing" }
        ],
        imageCount: 3,
        latestVersion: null
      }
    );

    expect(plan.aliasesToAppend).toEqual(["E-World"]);
    expect(plan.sourceUrlsToReview).toEqual(["https://example.test/listing"]);
    expect(plan.imageCountToReview).toBe(2);
  });

  it("marks active same-name same-address pairs as ready for review", () => {
    const plan = buildRetirePairPlan(
      { keepId: "keep-1", retireId: "retire-1" },
      {
        id: "keep-1",
        name: "국립대구과학관",
        status: "active",
        address: "대구 달성군 유가읍 테크노대로6길 20",
        lat: 35.686,
        lng: 128.465,
        tags: ["science_museum"],
        externalRefs: { aliases: ["대구과학관"] },
        sources: [],
        images: [],
        versions: [{ versionNumber: 2, action: "update", changeSummary: "Added source", createdAt: "2026-06-01T00:00:00.000Z" }]
      },
      {
        id: "retire-1",
        name: "국립대구과학관",
        status: "active",
        address: "대구 달성군 유가읍 테크노대로6길 20",
        lat: 35.686,
        lng: 128.465,
        tags: ["science_museum", "국립대구과학관"],
        externalRefs: { aliases: ["대구과학관", "Daegu Science Museum"] },
        sources: [{ sourceType: "public_listing", title: "목록", url: "https://example.test/listing" }],
        images: [{ url: "https://example.test/image.jpg" }],
        versions: []
      }
    );

    expect(plan.status).toBe("ready_for_review");
    expect(plan.warnings).toEqual([]);
    expect(plan.transferPlan.aliasesToAppend).toEqual(["Daegu Science Museum", "국립대구과학관"]);
    expect(plan.transferPlan.sourceUrlsToReview).toEqual(["https://example.test/listing"]);
  });

  it("blocks plans when the retire candidate is already non-active", () => {
    const plan = buildRetirePairPlan(
      { keepId: "keep-1", retireId: "retire-1" },
      { id: "keep-1", name: "경주월드", status: "active", sources: [], images: [] },
      { id: "retire-1", name: "경주월드", status: "closed", sources: [], images: [] }
    );

    expect(plan.status).toBe("blocked");
    expect(plan.warnings).toContain("blocked_retire_not_active");
  });
});
