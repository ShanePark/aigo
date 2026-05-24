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

  it("rejects personalized household wording in public place fields", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      parentNotes: "첫째가 뛰어놀기 좋고 쌍둥이 영아와 함께라면 유모차 산책 위주로 보는 것이 좋다.",
      placeScoreRationale: "사용자의 가족 구성에는 맞지만 일반 추천에는 주의가 필요하다."
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_public_text_personalization",
          path: "parentNotes",
          severity: "error"
        }),
        expect.objectContaining({
          code: "workflow_public_text_personalization",
          path: "placeScoreRationale",
          severity: "error"
        })
      ])
    );
  });

  it("rejects birth-year and older-child shorthand in public place fields", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      description: "2023년생 첫 방문 후보이며 큰아이 활동량 해소에 좋다."
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_public_text_personalization",
          path: "description",
          severity: "error"
        })
      ])
    );
  });

  it("warns when local family candidates have no parent-facing review evidence", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      externalRefs: {
        coordinateProvenance: validPayload().externalRefs.coordinateProvenance
      },
      sources: [
        {
          sourceType: "official_site",
          title: "Official place page",
          url: "https://example.com/place",
          summary: "Official page confirms the address and family facilities.",
          checkedAt: "2026-05-23T14:00:00.000+09:00"
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_parent_review_evidence",
          path: "externalRefs.parentReviewEvidence",
          severity: "warning"
        })
      ])
    );
  });

  it("accepts explicit not_found parent review evidence after research", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      sources: [
        {
          sourceType: "official_site",
          title: "Official place page",
          url: "https://example.com/place",
          summary: "Official page confirms the address and family facilities.",
          checkedAt: "2026-05-23T14:00:00.000+09:00"
        }
      ],
      externalRefs: {
        ...validPayload().externalRefs,
        parentReviewEvidence: {
          status: "not_found",
          attemptedQueries: ["서울 아이랑 테스트 쇼핑몰", "서울 유모차 테스트 쇼핑몰"]
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.code)).not.toContain("workflow_parent_review_evidence");
  });

  it("warns when private kids cafe candidates rely only on blog evidence", () => {
    const result = validateResearchPayload({
      ...validPayload({
        primaryCategory: "kids_cafe",
        sources: [
          {
            sourceType: "public_blog",
            title: "Parent visit note",
            url: "https://example.com/parent-review",
            summary: "Parent-facing note describes play equipment and crowding.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          }
        ]
      })
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_private_kids_cafe_blog_only",
          path: "sources",
          severity: "warning"
        })
      ])
    );
  });

  it("accepts public listing plus booking evidence for private kids cafes", () => {
    const result = validateResearchPayload({
      ...validPayload({
        primaryCategory: "kids_cafe",
        reservationUrl: "https://example.com/booking",
        sources: [
          {
            sourceType: "public_listing",
            title: "Kids cafe listing",
            url: "https://example.com/listing",
            summary: "Public listing confirms the branch identity, address, and listing photos.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          },
          {
            sourceType: "public_blog",
            title: "Parent visit note",
            url: "https://example.com/parent-review",
            summary: "Parent-facing note describes toddler fit and stroller friction.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          }
        ]
      })
    });

    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.code)).not.toContain("workflow_private_kids_cafe_blog_only");
    expect(result.issues.map((issue) => issue.code)).not.toContain("workflow_private_kids_cafe_operator_evidence");
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
      },
      {
        sourceType: "public_blog",
        title: "Parent visit note",
        url: "https://example.com/parent-review",
        summary: "Parent-facing note describes stroller access and toddler fit in the author's own visit context.",
        checkedAt: "2026-05-23T14:00:00.000+09:00"
      }
    ],
    ...overrides
  };
}
