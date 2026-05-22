import { describe, expect, it } from "vitest";

import { createPlaceSchema, placeImageHealthQuerySchema, searchPlacesSchema, updatePlaceSchema } from "@/lib/schemas";

describe("place schemas", () => {
  it("requires coordinates and at least one source when creating a place", () => {
    const result = createPlaceSchema.safeParse({
      name: "테스트 장소",
      primaryCategory: "indoor_playground",
      address: "대전",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.success).toBe(false);
  });

  it("accepts kid-primary accommodations", () => {
    const result = createPlaceSchema.parse({
      name: "테스트 숙소",
      primaryCategory: "accommodation",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.primaryCategory).toBe("accommodation");
  });

  it("defaults search pagination and keeps facility preferences soft", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      preferences: {
        strollerFriendly: true,
        foodAllowed: true
      }
    });

    expect(result.limit).toBe(20);
    expect(result.radiusKm).toBe(80);
    expect(result.preferences?.strollerFriendly).toBe(true);
    expect(result.preferences?.foodAllowed).toBe(true);
  });

  it("allows searches to calculate distance without applying a radius filter", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      filterByRadius: false
    });

    expect(result.origin).toEqual({ lat: 36.35, lng: 127.38 });
    expect(result.radiusKm).toBe(80);
    expect(result.filterByRadius).toBe(false);
  });

  it("accepts hard distance bands when an origin is provided", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      minDistanceKm: 25,
      maxDistanceKm: 120,
      filterByRadius: false
    });
    const missingOrigin = searchPlacesSchema.safeParse({ minDistanceKm: 25 });
    const invertedBand = searchPlacesSchema.safeParse({
      origin: { lat: 36.35, lng: 127.38 },
      minDistanceKm: 120,
      maxDistanceKm: 25
    });

    expect(result.minDistanceKm).toBe(25);
    expect(result.maxDistanceKm).toBe(120);
    expect(result.filterByRadius).toBe(false);
    expect(missingOrigin.success).toBe(false);
    expect(invertedBand.success).toBe(false);
  });

  it("accepts optional search diversity caps", () => {
    const result = searchPlacesSchema.parse({
      diversity: {
        maxPerRegion: 2,
        maxPerCategory: 3
      }
    });
    const empty = searchPlacesSchema.safeParse({ diversity: {} });
    const invalid = searchPlacesSchema.safeParse({ diversity: { maxPerRegion: 0 } });

    expect(result.diversity).toEqual({
      maxPerRegion: 2,
      maxPerCategory: 3
    });
    expect(empty.success).toBe(false);
    expect(invalid.success).toBe(false);
  });

  it("accepts compact search projection for agent planning calls", () => {
    const result = searchPlacesSchema.parse({
      query: "공공 어린이 체험",
      projection: "compact"
    });
    const invalid = searchPlacesSchema.safeParse({ projection: "tiny" });

    expect(result.projection).toBe("compact");
    expect(invalid.success).toBe(false);
  });

  it("accepts common agent aliases for search location and child ages", () => {
    const result = searchPlacesSchema.parse({
      location: { lat: 36.35, lng: 127.38, label: "대전역" },
      childAgesMonths: [32, 7, 7]
    });

    expect(result.origin).toEqual({ lat: 36.35, lng: 127.38, label: "대전역" });
    expect(result.childAgeMonths).toEqual([32, 7, 7]);
  });

  it("accepts planned visit date and time for search scoring", () => {
    const result = searchPlacesSchema.parse({
      visitDate: "2026-05-23",
      visitStartTime: "10:30"
    });
    const invalid = searchPlacesSchema.safeParse({
      visitDate: "2026-02-30",
      visitStartTime: "10:30"
    });
    const timeWithoutDate = searchPlacesSchema.safeParse({
      visitStartTime: "10:30"
    });

    expect(result.visitDate).toBe("2026-05-23");
    expect(result.visitStartTime).toBe("10:30");
    expect(invalid.success).toBe(false);
    expect(timeWithoutDate.success).toBe(false);
  });

  it("defaults update source mode to append and accepts replace", () => {
    const append = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });
    const replace = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com" }],
      sourceMode: "replace"
    });

    expect(append.sourceMode).toBe("append");
    expect(replace.sourceMode).toBe("replace");
  });

  it("accepts reservation and session planning flags", () => {
    const result = createPlaceSchema.parse({
      name: "예약제 어린이 시설",
      primaryCategory: "experience_center",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      reservationRequired: "yes",
      walkInAvailable: "partial",
      sessionBased: "yes",
      sameDayAvailabilityKnown: "unknown",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });
    const invalid = updatePlaceSchema.safeParse({
      reservationRequired: "required",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.reservationRequired).toBe("yes");
    expect(result.walkInAvailable).toBe("partial");
    expect(result.sessionBased).toBe("yes");
    expect(result.sameDayAvailabilityKnown).toBe("unknown");
    expect(invalid.success).toBe(false);
  });

  it("accepts structured parking friction fields", () => {
    const result = updatePlaceSchema.parse({
      parkingFrictionLevel: "high",
      peakParkingWindow: "Weekend late mornings",
      parkingWaitNote: "Large public events can make on-site parking slow; consider nearby overflow parking.",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });
    const invalid = updatePlaceSchema.safeParse({
      parkingFrictionLevel: "severe",
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.parkingFrictionLevel).toBe("high");
    expect(result.peakParkingWindow).toBe("Weekend late mornings");
    expect(result.parkingWaitNote).toContain("overflow parking");
    expect(invalid.success).toBe(false);
  });

  it("accepts itinerary cluster related-place metadata", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "agent_observation", externalId: "related-place-audit-20260522" }],
      relatedPlaceMode: "replace",
      relatedPlaces: [
        {
          placeId: "96640384-4dff-4470-a40e-75d1491f1e73",
          relationType: "itinerary_cluster",
          note: "아산 day-trip cluster에서 함께 묶어 비교할 장소.",
          evidence: {
            clusterName: "Asan science and ecology half-day",
            sharedDriveBurden: "same_outbound_drive",
            mealRestFallback: "Use nearby family restaurant or rest stop after both venues.",
            parentEffortNotes: "Works best when paired as one planned drive rather than two separate trips."
          }
        }
      ]
    });

    expect(result.relatedPlaceMode).toBe("replace");
    expect(result.relatedPlaces?.[0]).toMatchObject({
      placeId: "96640384-4dff-4470-a40e-75d1491f1e73",
      relationType: "itinerary_cluster",
      evidence: {
        clusterName: "Asan science and ecology half-day",
        sharedDriveBurden: "same_outbound_drive"
      }
    });
  });

  it("accepts structured image entities for visual audit metadata", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }],
      imageMode: "replace",
      images: [
        {
          url: "https://example.com/place.jpg",
          sourceUrl: "https://example.com/place",
          sourceType: "official_image_source",
          sourceTitle: "공식 대표 사진",
          description: "실내 놀이 공간과 낮은 미끄럼틀이 보이는 대표 사진.",
          visualFeatures: ["indoor_play", "slide"],
          childSignals: { slide: true, swing: false },
          displayTier: "official",
          reviewStatus: "approved",
          isPrimary: true
        }
      ]
    });

    expect(result.imageMode).toBe("replace");
    expect(result.images?.[0]).toMatchObject({
      displayTier: "official",
      reviewStatus: "approved",
      visualFeatures: ["indoor_play", "slide"],
      childSignals: { slide: true, swing: false }
    });
  });

  it("accepts place-level playground equipment signals", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "user_observation", externalId: "user-20260522-gao-playground" }],
      playFeatures: {
        slide: "yes",
        swing: "no",
        waterPlayground: "yes",
        sandPlay: "unknown",
        strollerPath: "partial",
        notes: "사용자 관찰 기반. 공개 출처로 재확인 필요.",
        evidence: [
          {
            feature: "slide",
            value: "yes",
            basis: "사용자가 가오근린공원 놀이터에 미끄럼틀이 있다고 제보.",
            confidence: "user_reported"
          }
        ]
      }
    });

    expect(result.playFeatures).toMatchObject({
      slide: "yes",
      swing: "no",
      waterPlayground: "yes",
      strollerPath: "partial"
    });
  });

  it("accepts source-backed objective score fields", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "public_listing", url: "https://example.com/place" }],
      placeScore: 8.4,
      placeScoreRationale: "아이 활동성, 영아 편의, 운영 신뢰도가 모두 좋아 높은 점수.",
      externalRatingScore: 7.8,
      externalReviewCount: 42,
      searchEvidenceScore: 8.1,
      scoreSignals: {
        external: [{ provider: "public_listing", rating: 3.9, scale: 5, reviewCount: 42 }],
        caps: []
      },
      scoreUpdatedAt: "2026-05-22T09:00:00+09:00"
    });

    expect(result.placeScore).toBe(8.4);
    expect(result.externalReviewCount).toBe(42);
    expect(result.scoreSignals).toMatchObject({
      caps: []
    });
  });

  it("rejects out-of-range score fields", () => {
    const result = updatePlaceSchema.safeParse({
      sources: [{ sourceType: "public_listing", url: "https://example.com/place" }],
      placeScore: 10.5
    });

    expect(result.success).toBe(false);
  });

  it("parses image health query strings for agent queues", () => {
    const result = placeImageHealthQuerySchema.parse({
      primaryCategory: "family_restaurant",
      status: "no_active_image",
      limit: "25",
      offset: "50"
    });

    expect(result).toEqual({
      primaryCategory: "family_restaurant",
      status: "no_active_image",
      limit: 25,
      offset: 50
    });
  });
});
