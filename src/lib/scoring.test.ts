import { describe, expect, it } from "vitest";

import { scorePlace } from "@/lib/scoring";
import type { SearchPlacesInput } from "@/lib/schemas";

const baseInput: SearchPlacesInput = {
  origin: { lat: 36.3504, lng: 127.3845, label: "대전" },
  radiusKm: 80,
  childAgeMonths: [32, 7, 7],
  preferences: {
    indoorTypes: ["indoor", "mixed"],
    parkingAvailable: true,
    strollerFriendly: true,
    nursingRoom: true,
    diaperChangingTable: true,
    foodAllowed: true
  },
  sort: "recommended",
  limit: 20,
  offset: 0
};

describe("scorePlace", () => {
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
    expect(result.reasonCodes).toContain("FOOD_ALLOWED_UNKNOWN");
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
        nursingRoom: true,
        diaperChangingTable: true,
        elevator: true
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
          placeScore: 8.8,
          placeScoreRationale: "객관적 가족 편의는 좋지만 즉시 아이 활동 목적지는 아님.",
          externalRatingScore: 8.2,
          externalReviewCount: 250,
          searchEvidenceScore: 8,
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
});
