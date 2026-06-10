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

  it("rejects legacy imageUrls mixed with structured images", () => {
    const result = validateResearchPayload({ ...validPayload(), imageUrls: ["https://example.com/legacy-extra.jpg"] });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_legacy_image_urls_with_images",
          path: "imageUrls",
          severity: "error"
        })
      ])
    );
  });

  it("rejects nested facility and visit blocks that the places API would ignore", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      facilities: {
        indoorType: "outdoor",
        parkingAvailable: "yes",
        nursingRoom: "unknown"
      },
      visit: {
        averageStayMinutes: 90,
        parentEffortLevel: 2
      }
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_unsupported_nested_api_block",
          path: "facilities",
          severity: "error"
        }),
        expect.objectContaining({
          code: "workflow_unsupported_nested_api_block",
          path: "visit",
          severity: "error"
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

  it("rejects English-dominant public place text", () => {
    const result = validateResearchPayload({
      ...validPayload(),
      description:
        "This is a source-backed kid-focused lodging candidate collected for nationwide AiGo family stay coverage. Family fit is based on official public evidence.",
      parentNotes: "주차, 유모차 이동, 수유실 확인이 필요한 대형 실내 fallback 후보다."
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_public_text_korean",
          path: "description",
          severity: "error"
        })
      ])
    );
    expect(result.issues.map((issue) => `${issue.path}:${issue.code}`)).not.toContain("parentNotes:workflow_public_text_korean");
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

  it("warns when parent review evidence omits review URLs and not_found query detail", () => {
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
        reviewLinks: ["부모 후기 요약은 확인했지만 URL을 보존하지 못했다."]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_parent_review_evidence_detail",
          path: "externalRefs.parentReviewEvidence",
          severity: "warning"
        })
      ])
    );
  });

  it("accepts parent review URLs preserved in externalRefs reviewLinks", () => {
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
        reviewLinks: [
          {
            title: "Parent-facing place review",
            url: "https://example.com/parent-review"
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.code)).not.toEqual(
      expect.arrayContaining(["workflow_parent_review_evidence", "workflow_parent_review_evidence_detail"])
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

  it("warns when rich public destinations omit subfacility sweep queries", () => {
    const result = validateResearchPayload({
      ...validPayload({
        primaryCategory: "park",
        externalRefs: {
          coordinateProvenance: validPayload().externalRefs.coordinateProvenance
        },
        pricing: undefined,
        scoreSignals: undefined,
        parentNotes: "공식 페이지는 넓은 야외 시설을 안내한다."
      })
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_subfacility_sweep_missing",
          path: "externalRefs.subfacilitySweep",
          severity: "warning"
        })
      ])
    );
  });

  it("accepts structured subfacility sweep queries, findings, and source URLs", () => {
    const result = validateResearchPayload({
      ...validPayload({
        primaryCategory: "museum",
        externalRefs: {
          ...validPayload().externalRefs,
          subfacilitySweep: {
            checkedAt: "2026-05-25T05:26:30+09:00",
            queries: [
              "국립항공박물관 어린이 체험",
              "국립항공박물관 체험 프로그램 예약",
              "국립항공박물관 수유실 유모차",
              "국립항공박물관 주차",
              "국립항공박물관 전망대 아이랑"
            ],
            findings: [
              "Official experience page confirms hands-on aviation program fit.",
              "Parent review evidence supports children airport experience and airport runway viewing value.",
              "Reservation/session friction remains partial because popular experiences have limited capacity."
            ],
            sourceUrls: ["https://www.aviation.or.kr/contents.do?menuno=311&tabno=4", "https://example.com/parent-review"]
          }
        },
        parentNotes: "어린이 체험 프로그램은 예약과 정원 확인이 필요하고, 주차 혼잡 가능성이 있다.",
        sources: [
          {
            sourceType: "official_site",
            title: "Official place page",
            url: "https://example.com/place",
            summary: "Official page confirms child experience program details and parking.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          },
          {
            sourceType: "public_blog",
            title: "Parent visit note",
            url: "https://example.com/parent-review",
            summary: "Parent-facing note describes child experience fit and stroller access.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          }
        ]
      })
    });

    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.code)).not.toContain("workflow_subfacility_sweep_missing");
    expect(result.issues.map((issue) => issue.code)).not.toContain("workflow_subfacility_sweep_unstructured");
  });

  it("warns when subfacility sweep findings are not reflected in structured fields", () => {
    const result = validateResearchPayload({
      ...validPayload({
        primaryCategory: "park",
        externalRefs: {
          ...validPayload().externalRefs,
          subfacilitySweep: {
            attemptedQueries: ["테스트 공원 놀이터", "테스트 공원 수유실", "테스트 공원 주차"]
          }
        },
        pricing: undefined,
        scoreSignals: undefined,
        parentNotes: "공식 페이지는 넓은 야외 시설을 안내한다.",
        playFeatures: undefined,
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
            summary: "Parent-facing note describes general toddler fit.",
            checkedAt: "2026-05-23T14:00:00.000+09:00"
          }
        ]
      })
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "workflow_subfacility_sweep_unstructured",
          path: "externalRefs.subfacilitySweep",
          severity: "warning"
        })
      ])
    );
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
      },
      subfacilitySweep: {
        attemptedQueries: ["테스트 쇼핑몰 놀이터", "테스트 쇼핑몰 수유실", "테스트 쇼핑몰 무료"],
        checkedAt: "2026-05-23T14:00:00.000+09:00"
      }
    },
    pricing: {
      summary: "건물 입장은 무료이며 매장별 비용은 별도다.",
      checkedAt: "2026-05-23T14:00:00.000+09:00",
      sourceUrl: "https://example.com/place"
    },
    scoreSignals: {
      facilityScale: "large_multi_floor_mall",
      freeAdmission: true
    },
    parentNotes: "주차, 유모차 이동, 수유실 확인이 필요한 대형 실내 fallback 후보다.",
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
