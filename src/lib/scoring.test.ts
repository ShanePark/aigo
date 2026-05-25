import { describe, expect, it } from "vitest";

import { scorePlace, scorePlaceIntrinsic } from "@/lib/scoring";
import type { SearchPlacesInput } from "@/lib/schemas";
import { emptyPlaceTaxonomy } from "@/lib/taxonomy";

const baseInput: SearchPlacesInput = {
  origin: { lat: 36.3504, lng: 127.3845, label: "대전" },
  radiusKm: 80,
  childAgeMonths: [32, 7, 7],
  preferences: {
    indoorTypes: ["indoor", "mixed"],
    parkingAvailable: true,
    strollerFriendly: true,
    nursingRoom: true,
    babyChair: true
  },
  sort: "recommended",
  limit: 20,
  offset: 0
};

describe("scorePlace", () => {
  it("scores place quality without search relevance inputs", () => {
    const shared = {
      primaryCategory: "park",
      tags: ["children_playground"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 120,
      indoorType: "outdoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "unknown",
      diaperChangingTable: "unknown",
      kidsToilet: "yes",
      elevator: "unknown",
      babyChair: "unknown",
      foodAllowed: "partial",
      distanceKm: 1,
      visit: {
        averageStayMinutes: 90,
        parentEffortLevel: 2,
        childEngagementLevel: 5,
        rainyDayScore: 1,
        hotDayScore: 3,
        coldDayScore: 2
      },
      scoring: {
        placeScore: 8.8,
        placeScoreRationale: "놀이시설과 주차 근거가 강한 야외 놀이터.",
        externalRatingScore: null,
        externalReviewCount: null,
        searchEvidenceScore: null,
        scoreSignals: {},
        scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
      }
    };

    const intrinsic = scorePlaceIntrinsic(shared);
    const search = scorePlace(shared, {
      ...baseInput,
      query: "대전 모래놀이 놀이터",
      primaryCategories: ["park"],
      taxonomy: { mode: "soft", activityTypes: ["sand_play"] }
    });

    expect(intrinsic.reasonCodes).toContain("PLACE_SCORE_HIGH");
    expect(intrinsic.reasonCodes).toContain("PARKING_YES");
    expect(intrinsic.reasonCodes).not.toContain("CATEGORY_MATCH");
    expect(intrinsic.reasonCodes).not.toContain("DISTANCE_NEAR");
    expect(intrinsic.score).toBeGreaterThan(75);
    expect(intrinsic.scoreBreakdown.match).toBe(0);
    expect(intrinsic.scoreBreakdown.distance).toBe(0);
    expect(search.score).not.toBe(intrinsic.score);
  });

  it("uses requested taxonomy facets as soft match signals", () => {
    const input = {
      ...baseInput,
      taxonomy: {
        mode: "soft",
        activityTypes: ["sand_play"],
        logisticsTags: ["stroller"]
      }
    } satisfies SearchPlacesInput;
    const shared = {
      primaryCategory: "park",
      tags: [],
      dataConfidence: "agent_collected",
      minRecommendedAgeMonths: 12,
      maxRecommendedAgeMonths: 96,
      indoorType: "outdoor",
      parkingAvailable: "unknown",
      strollerFriendly: "unknown",
      nursingRoom: "unknown",
      diaperChangingTable: "unknown",
      kidsToilet: "unknown",
      elevator: "unknown",
      babyChair: "unknown",
      foodAllowed: "unknown",
      distanceKm: 4
    };
    const matched = scorePlace(
      {
        ...shared,
        taxonomy: {
          ...emptyPlaceTaxonomy(),
          sourceBacked: {
            ...emptyPlaceTaxonomy().sourceBacked,
            activityTypes: ["sand_play"],
            logisticsTags: ["stroller"]
          }
        }
      },
      input
    );
    const unknown = scorePlace(shared, input);

    expect(matched.score).toBeGreaterThan(unknown.score);
    expect(matched.reasonCodes).toEqual(expect.arrayContaining(["TAXONOMY_ACTIVITY_MATCH", "TAXONOMY_LOGISTICS_MATCH"]));
    expect(unknown.reasonCodes).toContain("TAXONOMY_UNKNOWN");
  });

  it("uses age as a soft positive signal", () => {
    const result = scorePlace(
      {
        primaryCategory: "indoor_playground",
        tags: [],
        dataConfidence: "operator_curated",
        minRecommendedAgeMonths: 24,
        maxRecommendedAgeMonths: 71,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "yes",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 3
      },
      baseInput
    );

    expect(result.reasonCodes).toContain("AGE_HINT_PARTIAL");
    expect(result.reasonCodes).toContain("STROLLER_PARTIAL");
    expect(result.score).toBeGreaterThan(45);
  });

  it("does not zero out places when age mismatches and facilities are unknown", () => {
    const result = scorePlace(
      {
        primaryCategory: "museum",
        tags: [],
        dataConfidence: "unknown",
        minRecommendedAgeMonths: 72,
        maxRecommendedAgeMonths: 120,
        indoorType: "unknown",
        parkingAvailable: "unknown",
        strollerFriendly: "unknown",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 12
      },
      baseInput
    );

    expect(result.reasonCodes).toContain("AGE_HINT_MISMATCH");
    expect(result.reasonCodes).toContain("PARKING_UNKNOWN");
    expect(result.reasonCodes).toContain("BABY_CHAIR_UNKNOWN");
    expect(result.score).toBeGreaterThan(0);
  });

  it("boosts farther destination-style places for day trips", () => {
    const nearby = scorePlace(
      {
        primaryCategory: "library",
        tags: [],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 2
      },
      { ...baseInput, visitContext: "dayTrip" }
    );
    const destination = scorePlace(
      {
        primaryCategory: "museum",
        tags: ["세종", "주말당일"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 24,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 25
      },
      { ...baseInput, visitContext: "dayTrip" }
    );

    expect(destination.score).toBeGreaterThan(nearby.score);
    expect(destination.reasonCodes).toContain("CONTEXT_DAY_TRIP_DISTANCE");
    expect(nearby.reasonCodes).toContain("CONTEXT_DAY_TRIP_TOO_CLOSE");
  });

  it("does not let nearby public indoor facilities dominate day-trip nature intent", () => {
    const nearbyPublicFacility = scorePlace(
      {
        primaryCategory: "experience_center",
        tags: ["children_experience"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "yes",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 10,
        scoring: {
          placeScore: 8.5,
          placeScoreRationale: "강한 공공 실내시설이지만 근교 자연 나들이 목적지는 아님.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 8.8,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T13:50:00+09:00"
        }
      },
      { ...baseInput, visitContext: "dayTrip" }
    );
    const fartherPark = scorePlace(
      {
        primaryCategory: "park",
        tags: ["주말당일"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 24,
        maxRecommendedAgeMonths: 144,
        indoorType: "outdoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 30,
        scoring: {
          placeScore: 7.2,
          placeScoreRationale: "근교 자연 나들이 목적지.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 7.4,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T13:50:00+09:00"
        }
      },
      { ...baseInput, visitContext: "dayTrip" }
    );

    expect(fartherPark.score).toBeGreaterThan(nearbyPublicFacility.score);
    expect(nearbyPublicFacility.reasonCodes).toContain("CONTEXT_DAY_TRIP_TOO_CLOSE");
    expect(fartherPark.reasonCodes).toContain("CONTEXT_DAY_TRIP_DISTANCE");
  });

  it("treats playroom restaurants as useful after-daycare and half-day meal support", () => {
    const place = {
      primaryCategory: "family_restaurant",
      tags: ["놀이방식당"],
      dataConfidence: "agent_collected",
      minRecommendedAgeMonths: 24,
      maxRecommendedAgeMonths: 144,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "partial",
      nursingRoom: "unknown",
      diaperChangingTable: "unknown",
      kidsToilet: "unknown",
      elevator: "unknown",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 4
    };

    const afterDaycare = scorePlace(place, { ...baseInput, visitContext: "afterDaycare", preferences: { babyChair: true } });
    const halfDay = scorePlace(place, { ...baseInput, visitContext: "weekendHalfDay", preferences: { babyChair: true } });

    expect(afterDaycare.reasonCodes).toContain("CONTEXT_AFTER_DAYCARE_CATEGORY");
    expect(afterDaycare.reasonCodes).toContain("BABY_CHAIR_YES");
    expect(halfDay.reasonCodes).toContain("CONTEXT_HALFDAY_MEAL_SUPPORT");
  });

  it("prefers child-primary short outings over generic family indoor spaces after daycare", () => {
    const input = {
      ...baseInput,
      visitContext: "afterDaycare" as const,
      preferences: {
        indoorTypes: ["indoor" as const],
        strollerFriendly: true,
        nursingRoom: true
      }
    };
    const toyLibrary = scorePlace(
      {
        primaryCategory: "library",
        tags: ["toy_library"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 60,
        indoorType: "indoor",
        parkingAvailable: "unknown",
        strollerFriendly: "partial",
        nursingRoom: "yes",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "no",
        distanceKm: 4
      },
      input
    );
    const genericFamilyCafe = scorePlace(
      {
        primaryCategory: "family_cafe",
        tags: ["family_cafe"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "unknown",
        strollerFriendly: "partial",
        nursingRoom: "yes",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 4
      },
      input
    );

    expect(toyLibrary.score).toBeGreaterThan(genericFamilyCafe.score);
    expect(toyLibrary.reasonCodes).toContain("CONTEXT_AFTER_DAYCARE_KID_PRIMARY");
    expect(genericFamilyCafe.reasonCodes).toContain("CONTEXT_AFTER_DAYCARE_GENERIC_FAMILY_SPACE");
  });

  it("penalizes outdoor half-day parks when infant amenities are unknown", () => {
    const input = {
      ...baseInput,
      visitContext: "weekendHalfDay" as const,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    };
    const outdoorPark = scorePlace(
      {
        primaryCategory: "park",
        tags: ["outdoor"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "outdoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "no",
        babyChair: "no",
        foodAllowed: "partial",
        distanceKm: 8
      },
      input
    );
    const publicChildFacility = scorePlace(
      {
        primaryCategory: "experience_center",
        tags: ["children_experience"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 84,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "yes",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 10
      },
      input
    );

    expect(publicChildFacility.score).toBeGreaterThan(outdoorPark.score);
    expect(outdoorPark.reasonCodes).toContain("CONTEXT_HALFDAY_INFANT_AMENITY_GAP");
    expect(publicChildFacility.reasonCodes).toContain("CONTEXT_HALFDAY_KID_PRIMARY");
  });

  it("uses stored objective and external evidence scores as ranking signals", () => {
    const shared = {
      primaryCategory: "indoor_playground",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "unknown",
      foodAllowed: "partial",
      distanceKm: 6
    };
    const high = scorePlace(
      {
        ...shared,
        scoring: {
          placeScore: 9,
          placeScoreRationale: "공식 시설 정보와 외부 평가가 모두 강한 실내 놀이 목적지.",
          externalRatingScore: 8.6,
          externalReviewCount: 180,
          searchEvidenceScore: 8.4,
          scoreSignals: { providers: ["public_listing"] },
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      baseInput
    );
    const low = scorePlace(
      {
        ...shared,
        scoring: {
          placeScore: 3.2,
          placeScoreRationale: "가족 편의 근거가 약하고 외부 평가도 낮음.",
          externalRatingScore: 4,
          externalReviewCount: 12,
          searchEvidenceScore: 3.5,
          scoreSignals: { providers: ["public_listing"] },
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      baseInput
    );

    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reasonCodes).toContain("PLACE_SCORE_HIGH");
    expect(high.reasonCodes).toContain("EXTERNAL_REVIEW_POSITIVE");
    expect(high.reasonCodes).toContain("SEARCH_EVIDENCE_STRONG");
    expect(low.reasonCodes).toContain("PLACE_SCORE_LOW");
    expect(low.reasonCodes).toContain("SEARCH_EVIDENCE_WEAK");
    expect(high.scoreBreakdown.placeQuality).toBeGreaterThan(0);
    expect(high.scoreBreakdown.externalEvidence).toBeGreaterThan(0);
  });

  it("adds conservative public value for free large public destinations", () => {
    const input = {
      ...baseInput,
      query: "가족 나들이",
      visitContext: "weekendHalfDay" as const,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        diaperChangingTable: true
      }
    };
    const shared = {
      primaryCategory: "park",
      tags: ["children_playground"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 144,
      indoorType: "outdoor",
      parkingAvailable: "yes",
      strollerFriendly: "partial",
      nursingRoom: "unknown",
      diaperChangingTable: "partial",
      kidsToilet: "yes",
      elevator: "unknown",
      babyChair: "unknown",
      foodAllowed: "partial",
      distanceKm: 30,
      scoring: {
        placeScore: 7.2,
        placeScoreRationale: "공공 야외 복합시설.",
        externalRatingScore: null,
        externalReviewCount: null,
        searchEvidenceScore: 7,
        scoreSignals: {},
        scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
      }
    };
    const plain = scorePlace(shared, input);
    const publicValue = scorePlace(
      {
        ...shared,
        pricing: {
          summary: "입장료 무료",
          items: [{ label: "입장료", amount: 0, currency: "KRW" }]
        },
        scoring: {
          ...shared.scoring,
          scoreSignals: {
            facilityScale: "large",
            freeAdmission: true
          }
        }
      },
      input
    );

    expect(publicValue.score).toBeGreaterThan(plain.score);
    expect(publicValue.scoreBreakdown.externalEvidence).toBeGreaterThan(plain.scoreBreakdown.externalEvidence);
    expect(publicValue.reasonCodes).toEqual(expect.arrayContaining(["PUBLIC_FREE_ADMISSION", "FACILITY_SCALE_LARGE"]));
  });

  it("recognizes low-cost public pricing without over-ranking it as free", () => {
    const result = scorePlace(
      {
        primaryCategory: "experience_center",
        tags: ["children_experience"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 96,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "partial",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 12,
        pricing: {
          items: [
            { label: "어린이 입장", amount: 3_000, currency: "KRW" },
            { label: "보호자 입장", amount: 2_000, currency: "KRW" }
          ]
        },
        scoring: {
          placeScore: 7,
          placeScoreRationale: "저렴한 공공 체험시설.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 7,
          scoreSignals: { facilityScale: { level: "medium" } },
          scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "weekendHalfDay" }
    );

    expect(result.reasonCodes).toContain("PUBLIC_LOW_COST");
    expect(result.reasonCodes).toContain("FACILITY_SCALE_MEDIUM");
    expect(result.reasonCodes).not.toContain("PUBLIC_FREE_ADMISSION");
  });

  it("does not treat paid admission with infant-free conditions as free admission", () => {
    const result = scorePlace(
      {
        primaryCategory: "theme_park",
        tags: ["theme_park", "outdoor_play"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "mixed",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "partial",
        elevator: "partial",
        babyChair: "partial",
        foodAllowed: "partial",
        distanceKm: 18,
        pricing: {
          summary: "종합이용권 대인 47,000원, 어린이 33,000원, 36개월 미만 무료",
          items: [
            { label: "대인 종합이용권", amount: 47_000, currency: "KRW" },
            { label: "어린이 종합이용권", amount: 33_000, currency: "KRW" },
            { label: "36개월 미만 입장", amount: 0, currency: "KRW", conditions: "보호자 동반" }
          ]
        },
        scoring: {
          placeScore: 7.5,
          placeScoreRationale: "공식 유료 입장권이 있는 대형 테마파크.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 7,
          scoreSignals: { facilityScale: "large" },
          scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "weekendHalfDay" }
    );

    expect(result.reasonCodes).toContain("FACILITY_SCALE_LARGE");
    expect(result.reasonCodes).not.toContain("PUBLIC_FREE_ADMISSION");
  });

  it("does not treat variable paid ticket notes with child-free conditions as free admission", () => {
    const result = scorePlace(
      {
        primaryCategory: "theme_park",
        tags: ["theme_park", "indoor_character"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "yes",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 42,
        pricing: {
          notes: "어린이 무료·할인 조건, 사전예약 가능 여부, 당일권 판매 여부는 방문일별 공식 티켓 안내를 우선 확인해야 합니다.",
          summary: "입장권 가격과 운영시간은 방문일에 따라 달라지는 구조로 공식 티켓·캘린더 확인이 필요합니다.",
          currency: "JPY"
        },
        scoring: {
          placeScore: 8,
          placeScoreRationale: "공식 날짜별 유료 입장권을 확인해야 하는 실내 테마파크.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 8,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "weekendHalfDay" }
    );

    expect(result.reasonCodes).not.toContain("PUBLIC_FREE_ADMISSION");
  });

  it("requires explicit pricing freeAdmission before treating bundled amenities as free admission", () => {
    const bundledAmenity = scorePlace(
      {
        primaryCategory: "resort",
        tags: ["resort", "kids_club", "water_play"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 12,
        maxRecommendedAgeMonths: 144,
        indoorType: "mixed",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "partial",
        foodAllowed: "partial",
        distanceKm: 120,
        pricing: {
          summary: "숙박객은 키즈클럽과 일부 워터파크 프로그램을 무료로 이용할 수 있습니다.",
          notes: "무료 문구는 리조트 입장료가 아니라 숙박 포함 부대시설 조건입니다."
        },
        scoring: {
          placeScore: 8,
          placeScoreRationale: "숙박객 대상 키즈 프로그램이 있는 리조트.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 7,
          scoreSignals: { facilityScale: "large" },
          scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "dayTrip" }
    );
    const explicitFreeAdmission = scorePlace(
      {
        primaryCategory: "public_child_facility",
        tags: ["children_experience", "public"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 120,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "yes",
        nursingRoom: "partial",
        diaperChangingTable: "yes",
        kidsToilet: "yes",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 8,
        pricing: {
          summary: "입장료 무료",
          freeAdmission: true
        },
        scoring: {
          placeScore: 7.5,
          placeScoreRationale: "무료로 이용 가능한 공공 어린이 시설.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 7,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-25T00:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "weekendHalfDay" }
    );

    expect(bundledAmenity.reasonCodes).toContain("FACILITY_SCALE_LARGE");
    expect(bundledAmenity.reasonCodes).not.toContain("PUBLIC_FREE_ADMISSION");
    expect(explicitFreeAdmission.reasonCodes).toContain("PUBLIC_FREE_ADMISSION");
  });

  it("prevents unscored places from saturating the ranking", () => {
    const strongLogistics = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "yes",
      elevator: "yes",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 1,
      visit: {
        averageStayMinutes: 90,
        parentEffortLevel: 1,
        childEngagementLevel: 5,
        rainyDayScore: 5,
        hotDayScore: 5,
        coldDayScore: 5
      }
    };
    const unscored = scorePlace(strongLogistics, { ...baseInput, visitContext: "afterDaycare" });
    const scored = scorePlace(
      {
        ...strongLogistics,
        scoring: {
          placeScore: 9,
          placeScoreRationale: "강한 출처 기반 장소 점수.",
          externalRatingScore: 8.5,
          externalReviewCount: 200,
          searchEvidenceScore: 8,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      { ...baseInput, visitContext: "afterDaycare" }
    );

    expect(unscored.score).toBeLessThanOrEqual(88);
    expect(scored.score).toBeGreaterThan(unscored.score);
  });

  it("penalizes closed places strongly for nearby-now searches", () => {
    const shared = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 2
    };
    const open = scorePlace({ ...shared, openingHours: { openNow: true } }, { ...baseInput, visitContext: "nearbyNow" });
    const closed = scorePlace({ ...shared, openingHours: { openNow: false } }, { ...baseInput, visitContext: "nearbyNow" });

    expect(open.score).toBeGreaterThan(closed.score);
    expect(open.reasonCodes).toContain("OPEN_NOW");
    expect(closed.reasonCodes).toContain("CLOSED_NOW");
    expect(closed.scoreBreakdown.openingHours).toBeLessThan(0);
  });

  it("evaluates weekly opening hours against Asia/Seoul and Korean weekday keys", () => {
    const shared = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 2
    };

    const result = scorePlace(
      {
        ...shared,
        openingHours: {
          weekly: {
            금요일: { opens: "10:00", closes: "18:00" },
            공휴일: { closed: true }
          }
        }
      },
      { ...baseInput, visitContext: "nearbyNow" },
      { now: new Date("2026-05-22T07:30:00.000Z") }
    );

    expect(result.reasonCodes).toContain("OPEN_NOW");
    expect(result.reasonCodes).not.toContain("CLOSED_NOW");
  });

  it("keeps Seoul overnight hours open after midnight", () => {
    const shared = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 2
    };

    const result = scorePlace(
      {
        ...shared,
        openingHours: {
          weekly: {
            금: { opens: "22:00", closes: "02:00" }
          }
        }
      },
      { ...baseInput, visitContext: "nearbyNow" },
      { now: new Date("2026-05-22T16:30:00.000Z") }
    );

    expect(result.reasonCodes).toContain("OPEN_NOW");
    expect(result.reasonCodes).not.toContain("CLOSED_NOW");
  });

  it("penalizes unknown hours for immediate visit searches", () => {
    const shared = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "yes",
      foodAllowed: "yes",
      distanceKm: 2
    };
    const open = scorePlace({ ...shared, openingHours: { openNow: true } }, { ...baseInput, visitContext: "nearbyNow" });
    const unknown = scorePlace(shared, { ...baseInput, visitContext: "nearbyNow" });

    expect(open.score).toBeGreaterThan(unknown.score);
    expect(unknown.reasonCodes).toContain("OPENING_HOURS_UNKNOWN");
    expect(unknown.scoreBreakdown.openingHours).toBeLessThan(0);
    expect(unknown.score).toBeLessThanOrEqual(82);
  });

  it("prefers child-primary places for immediate kids intent", () => {
    const input = {
      ...baseInput,
      query: "kids",
      visitContext: "nearbyNow" as const,
      preferences: {
        indoorTypes: ["indoor" as const],
        strollerFriendly: true,
        nursingRoom: true
      }
    };
    const kidsCafe = scorePlace(
      {
        primaryCategory: "kids_cafe",
        tags: ["kids"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 84,
        indoorType: "indoor",
        parkingAvailable: "unknown",
        strollerFriendly: "yes",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 2
      },
      input
    );
    const genericLibrary = scorePlace(
      {
        primaryCategory: "library",
        tags: ["library"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "yes",
        nursingRoom: "yes",
        diaperChangingTable: "yes",
        kidsToilet: "partial",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 2,
        scoring: {
          placeScore: 7.6,
          placeScoreRationale: "객관적 가족 편의는 좋지만 즉시 아이 활동 목적지는 아님.",
          externalRatingScore: 7.4,
          externalReviewCount: 250,
          searchEvidenceScore: 7,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );

    expect(kidsCafe.score).toBeGreaterThan(genericLibrary.score);
    expect(kidsCafe.reasonCodes).toContain("CONTEXT_NEARBY_NOW_KID_PRIMARY");
    expect(genericLibrary.reasonCodes).toContain("CONTEXT_NEARBY_NOW_GENERIC_FAMILY_SPACE");
  });

  it("weights playground searches toward very nearby options", () => {
    const input = {
      ...baseInput,
      query: "놀이터",
      visitContext: "nearbyNow" as const,
      primaryCategories: ["park"],
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true
      }
    };
    const shared = {
      primaryCategory: "park",
      tags: ["children_playground"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 144,
      indoorType: "outdoor",
      parkingAvailable: "yes",
      strollerFriendly: "partial",
      nursingRoom: "unknown",
      diaperChangingTable: "unknown",
      kidsToilet: "unknown",
      elevator: "unknown",
      babyChair: "unknown",
      foodAllowed: "partial"
    };
    const nearbyPlayground = scorePlace(
      {
        ...shared,
        distanceKm: 1.2,
        scoring: {
          placeScore: 6.8,
          placeScoreRationale: "가까운 동네 놀이터.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 6.8,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );
    const fartherPlayground = scorePlace(
      {
        ...shared,
        distanceKm: 12,
        scoring: {
          placeScore: 8.7,
          placeScoreRationale: "콘텐츠가 더 좋지만 동네 놀이터 목적에는 먼 편.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: 8.5,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );

    expect(nearbyPlayground.score).toBeGreaterThan(fartherPlayground.score);
    expect(nearbyPlayground.scoreBreakdown.distance).toBeGreaterThan(10);
    expect(fartherPlayground.scoreBreakdown.distance).toBeLessThan(0);
  });

  it("lets destination lodging quality outweigh simple proximity", () => {
    const input = {
      ...baseInput,
      primaryCategories: ["accommodation"],
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        diaperChangingTable: true
      }
    };
    const shared = {
      primaryCategory: "accommodation",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 144,
      indoorType: "mixed",
      parkingAvailable: "yes",
      strollerFriendly: "partial",
      nursingRoom: "unknown",
      diaperChangingTable: "partial",
      kidsToilet: "unknown",
      elevator: "unknown",
      babyChair: "unknown",
      foodAllowed: "partial"
    };
    const nearbyLodging = scorePlace(
      {
        ...shared,
        distanceKm: 8,
        scoring: {
          placeScore: 6.4,
          placeScoreRationale: "가깝지만 키즈 콘텐츠 근거는 보통.",
          externalRatingScore: 6.2,
          externalReviewCount: 20,
          searchEvidenceScore: 6.2,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );
    const destinationLodging = scorePlace(
      {
        ...shared,
        distanceKm: 95,
        scoring: {
          placeScore: 9.2,
          placeScoreRationale: "숙박 자체의 키즈 콘텐츠와 가족 편의 근거가 강함.",
          externalRatingScore: 8.6,
          externalReviewCount: 240,
          searchEvidenceScore: 8.8,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );

    expect(destinationLodging.score).toBeGreaterThan(nearbyLodging.score);
    expect(destinationLodging.scoreBreakdown.distance).toBeGreaterThanOrEqual(0);
    expect(destinationLodging.reasonCodes).toContain("DISTANCE_DAY_TRIP");
  });

  it("caps lodging scores when infant logistics evidence is sparse", () => {
    const input = {
      ...baseInput,
      primaryCategories: ["accommodation"],
      visitContext: "dayTrip" as const,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    };
    const weakLogistics = scorePlace(
      {
        primaryCategory: "accommodation",
        tags: ["kids"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "mixed",
        parkingAvailable: "unknown",
        strollerFriendly: "unknown",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "partial",
        distanceKm: 95,
        visit: {
          averageStayMinutes: 360,
          parentEffortLevel: 2,
          childEngagementLevel: 5,
          rainyDayScore: 4,
          hotDayScore: 4,
          coldDayScore: 4
        },
        scoring: {
          placeScore: 9.4,
          placeScoreRationale: "키즈 콘텐츠는 강하지만 영아 물류 근거가 희박함.",
          externalRatingScore: 9,
          externalReviewCount: 500,
          searchEvidenceScore: 9,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );
    const supportedLogistics = scorePlace(
      {
        primaryCategory: "accommodation",
        tags: ["kids"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "mixed",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "partial",
        diaperChangingTable: "yes",
        kidsToilet: "unknown",
        elevator: "yes",
        babyChair: "partial",
        foodAllowed: "partial",
        distanceKm: 95,
        visit: {
          averageStayMinutes: 360,
          parentEffortLevel: 2,
          childEngagementLevel: 5,
          rainyDayScore: 4,
          hotDayScore: 4,
          coldDayScore: 4
        },
        scoring: {
          placeScore: 9.4,
          placeScoreRationale: "키즈 콘텐츠와 영아 물류 근거가 함께 강함.",
          externalRatingScore: 9,
          externalReviewCount: 500,
          searchEvidenceScore: 9,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );

    expect(weakLogistics.score).toBeLessThanOrEqual(78);
    expect(weakLogistics.reasonCodes).toContain("LODGING_INFANT_LOGISTICS_GAP");
    expect(supportedLogistics.score).toBeGreaterThan(weakLogistics.score);
    expect(supportedLogistics.reasonCodes).toContain("LODGING_INFANT_LOGISTICS_EVIDENCE");
  });

  it("keeps kids cafe distance moderate so quality can overcome a short drive", () => {
    const input = {
      ...baseInput,
      visitContext: "afterDaycare" as const,
      primaryCategories: ["kids_cafe"],
      preferences: {
        indoorTypes: ["indoor" as const],
        parkingAvailable: true,
        strollerFriendly: true,
        diaperChangingTable: true
      }
    };
    const shared = {
      primaryCategory: "kids_cafe",
      tags: ["kids"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 0,
      maxRecommendedAgeMonths: 84,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "yes",
      nursingRoom: "unknown",
      diaperChangingTable: "yes",
      kidsToilet: "partial",
      elevator: "yes",
      babyChair: "unknown",
      foodAllowed: "partial"
    };
    const nearbyOkayCafe = scorePlace(
      {
        ...shared,
        distanceKm: 2,
        scoring: {
          placeScore: 6.4,
          placeScoreRationale: "가깝지만 콘텐츠와 외부 평가가 보통.",
          externalRatingScore: 6.2,
          externalReviewCount: 35,
          searchEvidenceScore: 6.4,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );
    const strongerCafe = scorePlace(
      {
        ...shared,
        distanceKm: 11,
        scoring: {
          placeScore: 9,
          placeScoreRationale: "조금 더 가지만 아이 활동성과 편의 근거가 강함.",
          externalRatingScore: 8.5,
          externalReviewCount: 180,
          searchEvidenceScore: 8.5,
          scoreSignals: {},
          scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
        }
      },
      input
    );

    expect(strongerCafe.score).toBeGreaterThan(nearbyOkayCafe.score);
    expect(nearbyOkayCafe.scoreBreakdown.distance).toBeGreaterThan(strongerCafe.scoreBreakdown.distance);
    expect(strongerCafe.scoreBreakdown.distance).toBeGreaterThan(0);
  });

  it("keeps playroom restaurants distance sensitive", () => {
    const input = {
      ...baseInput,
      visitContext: "afterDaycare" as const,
      primaryCategories: ["family_restaurant"],
      preferences: {
        parkingAvailable: true,
        babyChair: true
      }
    };
    const shared = {
      primaryCategory: "family_restaurant",
      tags: ["놀이방식당"],
      dataConfidence: "official_verified",
      minRecommendedAgeMonths: 24,
      maxRecommendedAgeMonths: 144,
      indoorType: "indoor",
      parkingAvailable: "yes",
      strollerFriendly: "partial",
      nursingRoom: "unknown",
      diaperChangingTable: "unknown",
      kidsToilet: "unknown",
      elevator: "unknown",
      babyChair: "yes",
      foodAllowed: "yes",
      scoring: {
        placeScore: 7.6,
        placeScoreRationale: "식사와 놀이를 함께 해결하는 후보.",
        externalRatingScore: 7.4,
        externalReviewCount: 80,
        searchEvidenceScore: 7.4,
        scoreSignals: {},
        scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
      }
    };
    const nearbyRestaurant = scorePlace({ ...shared, distanceKm: 3 }, input);
    const farRestaurant = scorePlace({ ...shared, distanceKm: 18 }, input);

    expect(nearbyRestaurant.score).toBeGreaterThan(farRestaurant.score);
    expect(nearbyRestaurant.scoreBreakdown.distance).toBeGreaterThan(10);
    expect(farRestaurant.scoreBreakdown.distance).toBeLessThan(0);
  });
});
