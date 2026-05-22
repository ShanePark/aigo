import { describe, expect, it } from "vitest";

import {
  applySearchDiversity,
  buildInfantLogisticsSignal,
  buildImageMetadata,
  buildOpeningHoursDataSignal,
  buildSearchOpeningHoursSummary,
  buildSearchQuery,
  buildSearchImageHealth,
  buildSearchCoursePlan,
  buildSearchPreferenceSemantics,
  buildSearchSourceSummary,
  categoryClauseForKeywordTerm,
  compactSearchPlaceItem,
  isBroadNatureIntentQuery,
  isBroadParentIntentQuery,
  isBroadWaterPlayIntentQuery,
  isRouteBreakIntentQuery,
  normalizeSearchInput,
  queryMatchSignal,
  relatedPlacePair,
  searchEvaluationDate,
  searchTermPatterns,
  shouldUseAnyKeywordMatch,
  shouldSearchAddressForTerm
} from "@/lib/places";

type CoursePlanTestItem = Parameters<typeof buildSearchCoursePlan>[0][number];

function courseItem(
  overrides: {
    id: string;
    name: string;
    primaryCategory: string;
    distanceKm: number | null;
    score: number;
    averageStayMinutes?: number | null;
    parentEffortLevel?: number | null;
    childEngagementLevel?: number | null;
    indoorType?: string;
    strollerFriendly?: string;
    elevator?: string;
    nursingRoom?: string;
    diaperChangingTable?: string;
    parkingAvailable?: string;
    babyChair?: string;
    foodAllowed?: string;
    imageHealth?: ReturnType<typeof buildSearchImageHealth>;
  }
) {
  return {
    ...overrides,
    visit: {
      averageStayMinutes: overrides.averageStayMinutes ?? 90,
      parentEffortLevel: overrides.parentEffortLevel ?? null,
      childEngagementLevel: overrides.childEngagementLevel ?? null
    },
    facilities: {
      indoorType: overrides.indoorType ?? "unknown",
      strollerFriendly: overrides.strollerFriendly ?? "unknown",
      elevator: overrides.elevator ?? "unknown",
      nursingRoom: overrides.nursingRoom ?? "unknown",
      diaperChangingTable: overrides.diaperChangingTable ?? "unknown",
      parkingAvailable: overrides.parkingAvailable ?? "unknown",
      babyChair: overrides.babyChair ?? "unknown",
      foodAllowed: overrides.foodAllowed ?? "unknown"
    },
    imageHealth: overrides.imageHealth
  } as unknown as CoursePlanTestItem;
}

describe("place search helpers", () => {
  const baseSearchInput = { radiusKm: 80, sort: "recommended" as const, limit: 20, offset: 0 };

  it("splits spaced Korean queries into AND-able ilike patterns", () => {
    expect(searchTermPatterns("보문산 전망대")).toEqual(["%보문산%", "%전망대%"]);
  });

  it("can calculate distance without applying the radius filter for wider day-trip planning", () => {
    const constrained = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      radiusKm: 80
    });
    const unconstrained = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      radiusKm: 80,
      filterByRadius: false
    });

    expect(constrained.sql).toContain("ST_DWithin");
    expect(constrained.sql).toContain("ST_Distance");
    expect(unconstrained.sql).not.toContain("ST_DWithin");
    expect(unconstrained.sql).toContain("ST_Distance");
    expect(unconstrained.params).toEqual([127.4348, 36.3317]);
  });

  it("applies hard distance bands for outside-city day-trip searches", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      minDistanceKm: 25,
      maxDistanceKm: 120,
      filterByRadius: false
    });

    expect(query.sql).not.toContain("ST_DWithin");
    expect(query.sql).toContain(" / 1000 >= ");
    expect(query.sql).toContain(" / 1000 <= ");
    expect(query.params).toEqual([127.4348, 36.3317, 127.4348, 36.3317, 25, 127.4348, 36.3317, 120]);
  });

  it("limits sorted search candidates by region and category diversity caps", () => {
    const items = [
      { name: "A", primaryCategory: "museum", region: { sido: "충남", sigungu: "부여군" } },
      { name: "B", primaryCategory: "museum", region: { sido: "충남", sigungu: "부여군" } },
      { name: "C", primaryCategory: "museum", region: { sido: "세종", sigungu: "세종시" } },
      { name: "D", primaryCategory: "park", region: { sido: "세종", sigungu: "세종시" } },
      { name: "E", primaryCategory: "park", region: { sido: "대전", sigungu: "동구" } }
    ];

    expect(applySearchDiversity(items, { maxPerRegion: 1 }).map((item) => item.name)).toEqual(["A", "C", "E"]);
    expect(applySearchDiversity(items, { maxPerCategory: 1 }).map((item) => item.name)).toEqual(["A", "D"]);
    expect(applySearchDiversity(items, { maxPerRegion: 1, maxPerCategory: 1 }).map((item) => item.name)).toEqual(["A", "D"]);
  });

  it("canonicalizes related-place pairs so the relation is bidirectional", () => {
    expect(relatedPlacePair("b0000000-0000-0000-0000-000000000000", "a0000000-0000-0000-0000-000000000000")).toEqual([
      "a0000000-0000-0000-0000-000000000000",
      "b0000000-0000-0000-0000-000000000000"
    ]);
  });

  it("collapses repeated whitespace in keyword queries", () => {
    expect(searchTermPatterns("  대청호   명상정원  ")).toEqual(["%대청호%", "%명상정원%"]);
  });

  it("builds planned visit wall-clock dates for opening-hours scoring", () => {
    const planned = searchEvaluationDate({ visitDate: "2026-05-23", visitStartTime: "10:30" });
    const defaultNoon = searchEvaluationDate({ visitDate: "2026-05-23" });

    expect(planned?.getFullYear()).toBe(2026);
    expect(planned?.getMonth()).toBe(4);
    expect(planned?.getDate()).toBe(23);
    expect(planned?.getHours()).toBe(10);
    expect(planned?.getMinutes()).toBe(30);
    expect(defaultNoon?.getHours()).toBe(12);
  });

  it("recognizes broad nature intent queries", () => {
    expect(isBroadNatureIntentQuery("공원 자연")).toBe(true);
    expect(isBroadNatureIntentQuery("숲 산책")).toBe(true);
    expect(isBroadNatureIntentQuery("동네놀이터 어린이공원")).toBe(true);
    expect(isBroadNatureIntentQuery("동네놀이터 어린이공원 모래놀이터")).toBe(true);
    expect(isBroadNatureIntentQuery("대청호 자연")).toBe(false);
  });

  it("recognizes water-play synonym queries that should not require every token", () => {
    expect(isBroadWaterPlayIntentQuery("물놀이 물놀이터 수경")).toBe(true);
    expect(isBroadWaterPlayIntentQuery("물놀이 바닥분수")).toBe(true);
    expect(isBroadWaterPlayIntentQuery("물놀이 유모차")).toBe(false);
  });

  it("recognizes route-break searches for rest areas and nursing stops", () => {
    expect(isRouteBreakIntentQuery("청남대 가는 길 수유실 휴게소")).toBe(true);
    expect(isRouteBreakIntentQuery("청남대 가는 길 수유실")).toBe(true);
    expect(isRouteBreakIntentQuery("대청호 휴게소")).toBe(true);
    expect(isRouteBreakIntentQuery("청남대 수유실")).toBe(false);
  });

  it("recognizes broad parent intent queries that should not require every token", () => {
    expect(isBroadParentIntentQuery("공원 자연 당일치기 유모차 주차")).toBe(true);
    expect(isBroadParentIntentQuery("공공시설 반나절 과학관 도서관 어린이")).toBe(true);
    expect(isBroadParentIntentQuery("영아 실내 공공시설")).toBe(true);
    expect(isBroadParentIntentQuery("공동육아나눔터 영유아 실내")).toBe(true);
    expect(isBroadParentIntentQuery("계룡산 유모차 주차")).toBe(false);
  });

  it("widens alternative attraction keyword searches without widening local category searches", () => {
    expect(shouldUseAnyKeywordMatch("아쿠아리움 동물원")).toBe(true);
    expect(shouldUseAnyKeywordMatch("과학관 체험 창의나래 넥스페리움")).toBe(true);
    expect(shouldUseAnyKeywordMatch("물놀이터 용수골 동산 판암")).toBe(true);
    expect(shouldUseAnyKeywordMatch("미끄럼틀 가오솔 범골 가오들")).toBe(true);
    expect(shouldUseAnyKeywordMatch("가팔 진등 용전 매봉 성남 선암 대동")).toBe(true);
    expect(shouldUseAnyKeywordMatch("점프홀릭 챔피언")).toBe(true);
    expect(shouldUseAnyKeywordMatch("오월드 장태산")).toBe(true);
    expect(shouldUseAnyKeywordMatch("대전 키즈카페")).toBe(false);
    expect(shouldUseAnyKeywordMatch("대전 서구 키즈카페")).toBe(false);
    expect(shouldUseAnyKeywordMatch("판암 동네놀이터")).toBe(false);
  });

  it("maps common Korean category terms to primary category clauses", () => {
    expect(categoryClauseForKeywordTerm("공원")).toBe("primary_category = 'park'");
    expect(categoryClauseForKeywordTerm("놀이터")).toBe("primary_category = any(array['park','indoor_playground','kids_cafe']::text[])");
    expect(categoryClauseForKeywordTerm("공동육아나눔터")).toBe("primary_category = 'toy_library'");
    expect(categoryClauseForKeywordTerm("장난감")).toBe("primary_category = any(array['toy_store','toy_library']::text[])");
    expect(categoryClauseForKeywordTerm("완구점")).toBe("primary_category = 'toy_store'");
    expect(categoryClauseForKeywordTerm("미끄럼틀")).toBeNull();
  });

  it("builds image metadata with source provenance and display tiers", () => {
    const official = buildImageMetadata(["https://example.go.kr/place.jpg"], [
      {
        id: "source-1",
        sourceType: "official_library_image_source",
        title: "공식 도서관 대표 사진",
        url: "https://example.go.kr/source",
        summary: "Official page exposes a representative image.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);
    const listing = buildImageMetadata(["https://cdn.example.com/restaurant.webp"], [
      {
        id: "source-2",
        sourceType: "public_listing_image_source",
        title: "DiningCode - 대전 지점 사진",
        url: "https://place.udanax.org/p/1173497/%EB%8C%80%EC%A0%84",
        summary: "Public listing image candidate.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);
    const news = buildImageMetadata(["https://daejeon.example.com/news-place.jpg"], [
      {
        id: "source-3",
        sourceType: "public_news_image_source",
        title: "지역 기사 사진",
        url: "https://daejeon.example.com/article/123",
        summary: "Public news article image candidate.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);

    expect(official.primaryImage).toMatchObject({
      url: "https://example.go.kr/place.jpg",
      sourceId: "source-1",
      sourceUrl: "https://example.go.kr/source",
      displayTier: "official",
      creditText: "공식 도서관 대표 사진",
      status: "active"
    });
    expect(listing.primaryImage).toMatchObject({
      sourceId: "source-2",
      displayTier: "public_listing",
      creditText: "DiningCode - 대전 지점 사진"
    });
    expect(news.primaryImage).toMatchObject({
      sourceId: "source-3",
      displayTier: "rights_unclear",
      creditText: "지역 기사 사진"
    });
  });

  it("summarizes search image health from active image rows", () => {
    const checkedAt = new Date("2026-05-22T02:00:00.000Z");
    const updatedAt = new Date("2026-05-22T03:00:00.000Z");

    expect(buildSearchImageHealth([])).toMatchObject({
      status: "no_active_image",
      suggestedAction: "find_first_image",
      priorityScore: 100,
      hasPrimary: false,
      primaryImageUrl: null
    });
    expect(
      buildSearchImageHealth([
        {
          url: "https://example.com/place.jpg",
          is_primary: false,
          review_status: "needs_review",
          checked_at: checkedAt,
          updated_at: updatedAt
        }
      ])
    ).toMatchObject({
      status: "no_primary",
      suggestedAction: "choose_primary_image",
      activeCount: 1,
      needsReviewCount: 1,
      primaryImageUrl: "https://example.com/place.jpg",
      latestImageCheckedAt: "2026-05-22T02:00:00.000Z",
      latestImageUpdatedAt: "2026-05-22T03:00:00.000Z"
    });
    expect(
      buildSearchImageHealth([
        {
          url: "https://example.com/place.jpg",
          is_primary: true,
          review_status: "approved",
          checked_at: checkedAt,
          updated_at: updatedAt
        }
      ])
    ).toMatchObject({
      status: "healthy",
      suggestedAction: "none",
      hasPrimary: true,
      approvedCount: 1
    });
  });

  it("summarizes source freshness and provenance for search results", () => {
    const now = new Date("2026-05-22T07:00:00.000Z");

    expect(buildSearchSourceSummary([], { now })).toMatchObject({
      sourceCount: 0,
      sourceTypes: [],
      bestSourceType: null,
      bestSourceTier: "none",
      latestSourceType: null,
      latestCheckedAt: null,
      freshnessStatus: "unchecked"
    });

    expect(
      buildSearchSourceSummary(
        [
          {
            source_type: "public_listing",
            checked_at: new Date("2026-01-10T00:00:00.000Z"),
            created_at: new Date("2026-01-10T00:00:00.000Z")
          },
          {
            source_type: "official_site",
            checked_at: new Date("2026-05-22T06:30:00.000Z"),
            created_at: new Date("2026-05-22T06:45:00.000Z")
          }
        ],
        { now }
      )
    ).toMatchObject({
      sourceCount: 2,
      sourceTypes: ["official_site", "public_listing"],
      bestSourceType: "official_site",
      bestSourceTier: "official",
      latestSourceType: "official_site",
      latestCheckedAt: "2026-05-22T06:30:00.000Z",
      latestCreatedAt: "2026-05-22T06:45:00.000Z",
      freshnessStatus: "checked_today"
    });

    expect(
      buildSearchSourceSummary(
        [
          {
            source_type: "operator_page",
            title: "Operator opening hours",
            summary: "Operator page confirms opening hours.",
            checked_at: "2026-05-21T07:00:00.000Z",
            created_at: "2026-05-20T07:00:00.000Z"
          }
        ],
        { now }
      )
    ).toMatchObject({
      sourceCount: 1,
      bestSourceType: "operator_page",
      latestCheckedAt: "2026-05-21T07:00:00.000Z",
      freshnessStatus: "recent",
      openingHoursEvidence: {
        sourceCount: 1,
        bestSourceTier: "operator",
        latestCheckedAt: "2026-05-21T07:00:00.000Z",
        freshnessStatus: "recent"
      }
    });
  });

  it("separates opening-hours source confidence from runtime open status", () => {
    const sourceSummary = buildSearchSourceSummary(
      [
        {
          source_type: "official_site",
          title: "대전신세계 공식 영업시간",
          summary: "Official page confirms operating hours.",
          checked_at: new Date("2026-05-22T06:30:00.000Z"),
          created_at: new Date("2026-05-22T06:45:00.000Z")
        }
      ],
      { now: new Date("2026-05-22T07:00:00.000Z") }
    );

    expect(buildOpeningHoursDataSignal({ note: "공식 페이지 확인 필요" })).toEqual({
      dataStatus: "unstructured",
      hasData: true,
      hasStructuredData: false
    });
    expect(buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(null), sourceSummary)).toMatchObject({
      dataStatus: "missing",
      confidenceLevel: "source_backed",
      sourceBacked: true,
      bestSourceTier: "official",
      latestCheckedAt: "2026-05-22T06:30:00.000Z",
      hasStructuredData: false
    });
    expect(buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal({ openNow: true }), sourceSummary)).toMatchObject({
      dataStatus: "structured",
      confidenceLevel: "high",
      hasStructuredData: true
    });
  });

  it("describes search preferences as soft ranking signals", () => {
    expect(
      buildSearchPreferenceSemantics({
        diaperChangingTable: true,
        nursingRoom: true,
        parkingAvailable: false,
        indoorTypes: ["indoor", "mixed"]
      })
    ).toEqual({
      mode: "soft",
      requestedKeys: ["diaperChangingTable", "indoorTypes", "nursingRoom"],
      unknownValuesRemainEligible: true,
      mismatchesRemainEligible: true,
      hardFilteringSupported: false
    });
  });

  it("summarizes infant logistics separately from child engagement", () => {
    expect(
      buildInfantLogisticsSignal({
        strollerFriendly: "yes",
        elevator: "yes",
        nursingRoom: "partial",
        diaperChangingTable: "unknown",
        babyChair: "no",
        parkingAvailable: "yes"
      })
    ).toEqual({
      confidenceLevel: "high",
      confidenceScore: 83,
      supportLevel: "moderate",
      supportScore: 58,
      knownCount: 5,
      unknownCount: 1,
      positiveSignals: ["strollerFriendly", "elevator", "parkingAvailable"],
      partialSignals: ["nursingRoom"],
      negativeSignals: ["babyChair"],
      missingSignals: ["diaperChangingTable"]
    });
  });

  it("builds compact search items without full image and scoring payloads", () => {
    const compact = compactSearchPlaceItem({
      id: "place-1",
      name: "대전 어린이 시설",
      primaryCategory: "museum",
      tags: ["어린이", "공공"],
      address: "대전광역시 중구",
      lat: 36.33,
      lng: 127.43,
      distanceKm: 2.4,
      score: 82,
      reasonCodes: ["DIAPER_TABLE_UNKNOWN"],
      reasons: [],
      dataConfidence: "agent_collected",
      recommendedAgeMonths: { min: 24, max: 96 },
      infantLogistics: {
        confidenceLevel: "medium",
        confidenceScore: 50,
        supportLevel: "moderate",
        supportScore: 50,
        knownCount: 3,
        unknownCount: 3,
        positiveSignals: ["strollerFriendly", "elevator"],
        partialSignals: ["parkingAvailable"],
        negativeSignals: [],
        missingSignals: ["nursingRoom", "diaperChangingTable", "babyChair"]
      },
      openingHoursSummary: {
        dataStatus: "structured",
        confidenceLevel: "high",
        sourceBacked: true,
        bestSourceType: "official_site",
        bestSourceTier: "official",
        sourceCount: 1,
        sourceTypes: ["official_site"],
        latestCheckedAt: "2026-05-22T00:00:00.000Z",
        freshnessStatus: "checked_today",
        hasStructuredData: true
      },
      facilities: {
        indoorType: "indoor",
        strollerFriendly: "yes",
        parkingAvailable: "yes",
        parkingFrictionLevel: "high",
        peakParkingWindow: "Weekend late mornings",
        parkingWaitNote: "Main lot can back up during public programs.",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "unknown"
      },
      visit: {
        reservationRequired: "yes",
        walkInAvailable: "partial",
        sessionBased: "yes",
        sameDayAvailabilityKnown: "unknown",
        averageStayMinutes: 90,
        parentEffortLevel: 2,
        childEngagementLevel: 4,
        rainyDayScore: 4,
        hotDayScore: 3,
        coldDayScore: 4
      },
      notes: { safety: null, parent: "시설 확인 필요" },
      primaryImage: { url: "https://example.com/place.jpg" },
      imageHealth: {
        primaryImageUrl: "https://example.com/fallback.jpg",
        status: "healthy",
        suggestedAction: "none",
        priorityScore: 0,
        activeCount: 1,
        approvedCount: 1,
        needsReviewCount: 0,
        pendingReviewCount: 0,
        hasPrimary: true,
        primaryReviewStatus: "approved",
        latestImageCheckedAt: null,
        latestImageUpdatedAt: null
      },
      sourceSummary: {
        sourceCount: 1,
        sourceTypes: ["official_site"],
        bestSourceType: "official_site",
        bestSourceTier: "official",
        latestSourceType: "official_site",
        latestCheckedAt: "2026-05-22T00:00:00.000Z",
        latestCreatedAt: "2026-05-22T00:00:00.000Z",
        freshnessStatus: "checked_today"
      }
    } as unknown as Parameters<typeof compactSearchPlaceItem>[0]);

    expect(compact).toMatchObject({
      id: "place-1",
      name: "대전 어린이 시설",
      primaryImageUrl: "https://example.com/place.jpg",
      infantLogistics: {
        supportLevel: "moderate"
      },
      openingHoursSummary: {
        confidenceLevel: "high"
      },
      facilities: {
        parkingFrictionLevel: "high",
        peakParkingWindow: "Weekend late mornings",
        parkingWaitNote: "Main lot can back up during public programs."
      },
      visit: {
        reservationRequired: "yes",
        walkInAvailable: "partial",
        sessionBased: "yes",
        sameDayAvailabilityKnown: "unknown",
        averageStayMinutes: 90,
        parentEffortLevel: 2,
        childEngagementLevel: 4
      }
    });
    expect(compact).not.toHaveProperty("images");
    expect(compact).not.toHaveProperty("playFeatures");
    expect(compact).not.toHaveProperty("scoring");
  });

  it("groups ranked search items into a practical course plan", () => {
    const plan = buildSearchCoursePlan([
      courseItem({
        id: "anchor",
        name: "어린이 과학관",
        primaryCategory: "science_museum",
        distanceKm: 42,
        score: 91,
        childEngagementLevel: 5,
        parentEffortLevel: 3,
        imageHealth: buildSearchImageHealth([])
      }),
      courseItem({
        id: "second",
        name: "근처 숲 놀이터",
        primaryCategory: "park",
        distanceKm: 44,
        score: 83,
        averageStayMinutes: 60
      }),
      courseItem({
        id: "meal",
        name: "놀이방 식당",
        primaryCategory: "family_restaurant",
        distanceKm: 45,
        score: 78,
        babyChair: "yes",
        foodAllowed: "yes"
      }),
      courseItem({
        id: "nap",
        name: "귀가길 휴게소",
        primaryCategory: "rest_area",
        distanceKm: 75,
        score: 72,
        parentEffortLevel: 1
      }),
      courseItem({
        id: "fallback",
        name: "실내 쇼핑몰",
        primaryCategory: "shopping_mall",
        distanceKm: 8,
        score: 70,
        indoorType: "indoor",
        strollerFriendly: "yes",
        elevator: "yes",
        nursingRoom: "partial"
      })
    ]);

    expect(plan.anchor).toMatchObject({
      id: "anchor",
      driveBurden: "moderate",
      estimatedParentEffort: 3,
      imageHealth: { status: "no_active_image", suggestedAction: "find_first_image" }
    });
    expect(plan.optionalSecondStop).toMatchObject({ id: "second" });
    expect(plan.mealCareBase).toMatchObject({ id: "meal", reasonCodes: expect.arrayContaining(["COURSE_MEAL_CARE_BASE"]) });
    expect(plan.napBreak).toMatchObject({ id: "nap", reasonCodes: expect.arrayContaining(["COURSE_NAP_BREAK"]) });
    expect(plan.abortFallback).toMatchObject({ id: "fallback", reasonCodes: expect.arrayContaining(["COURSE_ABORT_FALLBACK"]) });
  });

  it("turns facility words in ordinary keyword queries into soft preferences", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "키즈카페 수유실 기저귀 유모차" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        nursingRoom: true,
        diaperChangingTable: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 키즈카페 주차" })).toMatchObject({
      query: "판암 키즈카페",
      preferences: {
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 짧은 야외 놀이터" })).toMatchObject({
      query: "판암 놀이터",
      preferences: {
        indoorTypes: ["outdoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 장난감도서관 근처" })).toMatchObject({
      query: "판암 동네놀이터"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "장난감도서관" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 장난감도서관 근처" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 장난감 가게 근처" })).toMatchObject({
      query: "장난감가게"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "레고 스토어 주차" })).toMatchObject({
      query: "레고스토어",
      preferences: {
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 모래놀이" })).toMatchObject({
      query: "판암"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "범골 어린이공원 모래놀이터" })).toMatchObject({
      query: "범골"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "오월드 장태산 한밭수목원 대청호 사진 있는 가족 나들이" })).toMatchObject({
      query: "오월드 장태산 한밭수목원 대청호"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "하원 후 1-2시간 키즈카페 실내 주차 유모차 수유실 기저귀" })).toMatchObject({
      visitContext: "afterDaycare",
      query: "키즈카페",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 쌍둥이 유모차" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true,
        elevator: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 30분 키즈카페 수유실" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "홈경기 없는 날 키벤저스 주차 실내놀이" })).toMatchObject({
      query: "키벤저스",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "물놀이 물놀이터 수경 여름 운영 주차 유모차" })).toMatchObject({
      query: "물놀이 물놀이터 수경",
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "아이랑 밥 놀이방 식당 아기의자 주차 유모차" })).toMatchObject({
      query: "놀이방식당",
      preferences: {
        babyChair: true,
        parkingAvailable: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 장난감도서관 근처 놀이방 식당 아기의자 주차" })).toMatchObject({
      query: "판암 놀이방식당",
      preferences: {
        babyChair: true,
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "한밭수목원 근처 키즈룸 식당 엘리베이터" })).toMatchObject({
      query: "한밭수목원 놀이방식당",
      preferences: {
        elevator: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "수통골 놀이방 식당 아기의자 주차" })).toMatchObject({
      query: "수통골 놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "반석 캠핑식당 놀이방 아기의자 주차" })).toMatchObject({
      query: "반석 놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "자연 실내 대피" })).toMatchObject({
      query: "자연",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오면 자연 실내대안" })).toMatchObject({
      visitContext: "rainyDay",
      query: "자연",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "하원하고 한두시간만 있다 올 곳" })).toMatchObject({
      visitContext: "afterDaycare",
      query: undefined
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "아기랑 비올때 베이비라운지 있는 곳" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "쌍둥이 유모차 수유실 기저귀 갈기 편한 곳" })).toMatchObject({
      query: undefined,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true,
        elevator: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 아이랑 실내 가볼만한곳 유모차 수유실 기저귀" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "밥 먹으면서 애 놀릴 수 있는 곳" })).toMatchObject({
      query: "놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "서구 어린이도서관 간식 음식불가 그림책방" })).toMatchObject({
      query: "서구 어린이도서관 음식불가 그림책방"
    });
  });

  it("recognizes broad public and day-trip fallback parent queries", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "주말 반나절 공공시설 과학 도서관 어린이" })).toMatchObject({
      visitContext: "weekendHalfDay",
      query: "주말 반나절 공공시설 과학 도서관 어린이"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "주말 반나절 공공시설 과학관 도서관 어린이 무료 저렴 실내" })).toMatchObject({
      visitContext: "weekendHalfDay",
      query: "주말 반나절 공공시설 과학관 도서관 어린이 무료 저렴 실내",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(isBroadParentIntentQuery("공공 어린이 체험 박물관 과학관")).toBe(true);
    expect(normalizeSearchInput({ ...baseSearchInput, query: "공공 어린이 체험 박물관 과학관" })).toMatchObject({
      query: "공공 어린이 체험 박물관 과학관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 영아 실내 공공시설" })).toMatchObject({
      query: "대전역 영아 실내 공공시설",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "공동육아나눔터 영유아 실내" })).toMatchObject({
      query: "공동육아나눔터 영유아 실내",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "무료 실내 공공 아이랑 밥먹고 놀기 수유실 주차" })).toMatchObject({
      query: "무료 실내 공공 아이랑 밥먹고 놀기 수유실 주차",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        nursingRoom: true,
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "쇼핑몰 베이비라운지 수유실 기저귀 유모차 대여 푸드코트 주차" })).toMatchObject({
      query: "쇼핑몰 베이비라운지 수유실 기저귀 유모차 대여 푸드코트 주차",
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 기준 1시간권 자연 실내대피 비오면 피할 곳" })).toMatchObject({
      visitContext: "dayTrip",
      query: "자연"
    });
  });

  it("keeps special intent queries literal while still inferring preferences", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "청남대 가는 길 수유실 휴게소" })).toMatchObject({
      query: "청남대 가는 길 수유실 휴게소",
      preferences: {
        nursingRoom: true
      }
    });
  });

  it("does not use short region-like terms against address text", () => {
    expect(shouldSearchAddressForTerm("계룡", "계룡")).toBe(false);
  });

  it("uses address text for address-shaped queries", () => {
    expect(shouldSearchAddressForTerm("계룡로 598", "계룡로")).toBe(true);
    expect(shouldSearchAddressForTerm("대전로", "대전로")).toBe(false);
    expect(shouldSearchAddressForTerm("대전광역시", "대전광역시")).toBe(true);
  });

  it("boosts direct place-name keyword matches over tag-only matches", () => {
    const nameMatch = queryMatchSignal(
      {
        name: "공주산림휴양마을 목재문화체험장",
        tags: ["woodcraft"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );
    const tagMatch = queryMatchSignal(
      {
        name: "금산산림문화타운",
        tags: ["목재문화체험장"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );

    expect(nameMatch.delta).toBeGreaterThan(tagMatch.delta);
    expect(nameMatch.reasonCodes).toContain("QUERY_NAME_MATCH");
    expect(tagMatch.reasonCodes).toContain("QUERY_TAG_MATCH");
  });

  it("boosts name matches in listed-place queries over tag-only matches", () => {
    const nameMatch = queryMatchSignal(
      {
        name: "대전오월드",
        tags: [],
        description: null,
        address: null,
        roadAddress: null
      },
      "오월드 장태산 한밭수목원 대청호"
    );
    const tagMatch = queryMatchSignal(
      {
        name: "근처 가족 쉼터",
        tags: ["오월드"],
        description: null,
        address: null,
        roadAddress: null
      },
      "오월드 장태산 한밭수목원 대청호"
    );

    expect(nameMatch.delta).toBeGreaterThan(tagMatch.delta);
    expect(nameMatch.reasonCodes).toContain("QUERY_NAME_MATCH");
    expect(tagMatch.reasonCodes).toContain("QUERY_TAG_MATCH");
  });

  it("boosts exact place-name matches over partial museum-name matches", () => {
    const exactBuyeo = queryMatchSignal(
      {
        name: "국립부여박물관 어린이박물관",
        tags: ["어린이박물관"],
        description: null,
        address: null,
        roadAddress: null
      },
      "국립부여박물관 어린이박물관"
    );
    const partialSejong = queryMatchSignal(
      {
        name: "세종 국립어린이박물관",
        tags: ["어린이박물관"],
        description: null,
        address: null,
        roadAddress: null
      },
      "국립부여박물관 어린이박물관"
    );

    expect(exactBuyeo.delta).toBeGreaterThanOrEqual(partialSejong.delta + 8);
    expect(exactBuyeo.reasonCodes).toContain("QUERY_NAME_EXACT");
    expect(partialSejong.reasonCodes).toContain("QUERY_NAME_MATCH");
  });

  it("does not add literal query boosts for broad nature intent queries", () => {
    const signal = queryMatchSignal(
      {
        name: "세종호수공원",
        tags: ["공원", "자연"],
        description: "넓은 자연 산책 공원",
        address: null,
        roadAddress: null
      },
      "공원 자연"
    );

    expect(signal.delta).toBe(0);
    expect(signal.reasonCodes).toEqual([]);
  });

  it("adds query match signals for place-level playground features", () => {
    const signal = queryMatchSignal(
      {
        name: "가오근린공원",
        tags: ["공원"],
        description: null,
        address: null,
        roadAddress: null,
        playFeatures: {
          slide: "yes",
          swing: "no",
          waterPlayground: "yes",
          notes: "미끄럼틀과 물놀이터 관찰 기록"
        }
      },
      "미끄럼틀 물놀이터"
    );

    expect(signal.delta).toBeGreaterThan(0);
    expect(signal.reasonCodes).toContain("QUERY_PLAY_FEATURE_MATCH");
  });
});
