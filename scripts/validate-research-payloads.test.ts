import { describe, expect, it } from "vitest";

import {
  extractResearchPayloads,
  formatResearchPayloadLintResults,
  parseArgs,
  validateResearchPayload
} from "./validate-research-payloads";

describe("research payload workflow lint", () => {
  it("accepts a create payload that satisfies the AiGo collection workflow", () => {
    const result = validateResearchPayload(validPayload());

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects pending image review status before registration", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      images: [{ ...validPayload().images[0], reviewStatus: "pending_review" }]
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_image_review_status",
          path: "images.0.reviewStatus",
          severity: "error"
        })
      ])
    );
  });

  it("requires structured image provenance instead of imageUrls alone", () => {
    const result = validateResearchPayload({ ...validPayload(), images: undefined, imageUrls: ["https://example.com/place.jpg"] });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_images_required",
          path: "images"
        })
      ])
    );
  });

  it("rejects non-registration workflow status and confidence", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      status: "needs_review",
      dataConfidence: "needs_check"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["workflow_status", "workflow_data_confidence"])
    );
  });

  it("requires acceptable coordinate provenance", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      externalRefs: {
        coordinateProvenance: {
          level: "manual_hold",
          sourceUrl: "https://example.com/map",
          basis: "Approximate search result only."
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_coordinate_level",
          path: "externalRefs.coordinateProvenance.level"
        })
      ])
    );
  });

  it("reports API schema failures before workflow checks", () => {
    const result = validateResearchPayload({
      name: "좌표 없는 후보",
      primaryCategory: "shopping_mall",
      regionSido: "서울",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "api_schema",
          path: "lat"
        }),
        expect.objectContaining({
          code: "api_schema",
          path: "lng"
        })
      ])
    );
  });

  it("extracts JSON payload arrays and markdown fenced JSON payloads", () => {
    const payloads = extractResearchPayloads(JSON.stringify([validPayload(), validPayload({ name: "두 번째 후보" })]), "payloads.json");
    const markdownPayloads = extractResearchPayloads(
      ["Research note", "```json", JSON.stringify(validPayload({ name: "마크다운 후보" })), "```"].join("\n"),
      "research.md"
    );

    expect(payloads).toHaveLength(2);
    expect(markdownPayloads).toHaveLength(1);
    expect(markdownPayloads[0]).toMatchObject({ name: "마크다운 후보" });
  });

  it("formats warnings without failing the result", () => {
    const payload = validPayload({
      images: [{ ...validPayload().images[0], altText: undefined, description: undefined }]
    });
    const result = validateResearchPayload(payload, { source: "payload.json", index: 0 });
    const formatted = formatResearchPayloadLintResults([result]);

    expect(result.ok).toBe(true);
    expect(formatted).toContain("[ok] payload.json#1");
    expect(formatted).toContain("[warning] images.0.altText");
  });

  it("warns when official sources mention closure signals on active payloads", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      sources: [
        {
          sourceType: "official_site",
          title: "브릭캠퍼스 제주 공식 안내",
          url: "https://example.com/brickcampus",
          summary: "공식 사이트에 제주 지점은 종료 상태로 안내되어 있다.",
          checkedAt: "2026-05-24T17:30:00.000+09:00"
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_closed_source_signal",
          path: "sources.0.summary",
          severity: "warning"
        })
      ])
    );
  });

  it("parses CLI arguments", () => {
    expect(parseArgs(["--json", "a.json", "b.md"])).toEqual({
      json: true,
      paths: ["a.json", "b.md"]
    });
  });
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "테스트 쇼핑몰",
    primaryCategory: "shopping_mall",
    address: "서울특별시 중구 세종대로 110",
    regionSido: "서울특별시",
    lat: 37.5665,
    lng: 126.978,
    status: "active",
    dataConfidence: "agent_collected",
    externalRefs: {
      coordinateProvenance: {
        level: "public_address_coordinate",
        lat: 37.5665,
        lng: 126.978,
        coordinateSystem: "WGS84",
        sourceUrl: "https://example.com/address",
        sourceTitle: "Public address coordinate",
        basis: "Address coordinate page matches the exact road address.",
        addressMatched: "서울특별시 중구 세종대로 110",
        confidence: "high",
        checkedAt: "2026-05-23T14:00:00.000+09:00"
      }
    },
    taxonomy: {
      sourceBacked: {
        familyFitGates: ["retail_fallback"],
        logisticsTags: ["parking", "stroller"]
      },
      inferred: {
        activityTypes: ["shopping_browse"]
      }
    },
    images: [
      {
        url: "https://example.com/place.jpg",
        sourceUrl: "https://example.com/place",
        sourceType: "official_image_source",
        sourceTitle: "Official place page",
        displayTier: "official",
        reviewStatus: "approved",
        altText: "쇼핑몰 외관"
      }
    ],
    sources: [
      {
        sourceType: "official_site",
        title: "Official place page",
        url: "https://example.com/place",
        summary: "Official page confirms the address and family facilities.",
        checkedAt: "2026-05-23T14:00:00.000+09:00"
      }
    ],
    ...overrides
  };
}
