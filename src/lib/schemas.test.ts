import { describe, expect, it } from "vitest";

import {
  createPlaceSchema,
  deletePlaceSchema,
  duplicatePlaceSchema,
  placeImageHealthQuerySchema,
  searchPlacesSchema,
  taxonomySchema,
  updatePlaceSchema
} from "@/lib/schemas";

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

  it("rejects unknown primary categories", () => {
    const result = createPlaceSchema.safeParse({
      name: "임의 분류 장소",
      primaryCategory: "playground",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.success).toBe(false);
  });

  it("canonicalizes source type and region aliases on place inputs", () => {
    const result = createPlaceSchema.parse({
      name: "공식 출처 장소",
      primaryCategory: "library",
      regionSido: "충남",
      lat: 36.35,
      lng: 127.38,
      sources: [{ sourceType: "official_page", url: "https://example.com" }],
      images: [{ url: "https://example.com/place.jpg", sourceType: "official_library_image_source" }]
    });
    const invalidSource = updatePlaceSchema.safeParse({
      sources: [{ sourceType: "made_up_source", url: "https://example.com" }]
    });

    expect(result.regionSido).toBe("충청남도");
    expect(result.sources[0].sourceType).toBe("official_site");
    expect(result.images?.[0]?.sourceType).toBe("official_image_source");
    expect(invalidSource.success).toBe(false);
  });

  it("accepts duplicate checks with address evidence when coordinates are unknown", () => {
    const addressOnly = duplicatePlaceSchema.parse({
      name: "도담도담 장난감월드 검단점",
      roadAddress: "인천광역시 서구 완정로 123",
      regionSido: "인천",
      regionSigungu: "서구"
    });
    const missingLocation = duplicatePlaceSchema.safeParse({
      name: "좌표 없는 장소"
    });
    const partialCoordinates = duplicatePlaceSchema.safeParse({
      name: "위도만 있는 장소",
      lat: 36.35
    });

    expect(addressOnly.regionSido).toBe("인천");
    expect(addressOnly.limit).toBe(10);
    expect(addressOnly.radiusMeters).toBe(500);
    expect(missingLocation.success).toBe(false);
    expect(partialCoordinates.success).toBe(false);
  });

  it("accepts taxonomy v1 shape on place writes", () => {
    const result = taxonomySchema.parse({
      schemaVersion: 1,
      sourceBacked: {
        familyFitGates: ["child_primary"],
        logisticsTags: ["parking"]
      },
      inferred: {
        activityTypes: ["sand_play"],
        confidence: "medium",
        basis: "Legacy tags mention sand play."
      },
      migration: {
        legacyTags: ["모래놀이"],
        broadMappedTags: ["모래놀이"],
        unmappedTags: [],
        normalizedAt: "2026-05-23T00:00:00.000+09:00"
      }
    });
    const invalid = taxonomySchema.safeParse({
      schemaVersion: 1,
      inferred: { confidence: "certain" }
    });
    const create = createPlaceSchema.parse({
      name: "분류 장소",
      primaryCategory: "park",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      taxonomy: result,
      sources: [{ sourceType: "official_site", url: "https://example.com" }]
    });

    expect(result.sourceBacked.familyFitGates).toEqual(["child_primary"]);
    expect(result.inferred.activityTypes).toEqual(["sand_play"]);
    expect(create.taxonomy?.sourceBacked.familyFitGates).toEqual(["child_primary"]);
    expect(invalid.success).toBe(false);
  });

  it("accepts source-backed pricing with a price basis date", () => {
    const result = createPlaceSchema.parse({
      name: "유료 키즈카페",
      primaryCategory: "kids_cafe",
      regionSido: "대전",
      lat: 36.35,
      lng: 127.38,
      pricing: {
        summary: "어린이 2시간 15,000원, 보호자 4,000원",
        currency: "KRW",
        basisDate: "2026-05-22",
        checkedAt: "2026-05-22T09:00:00.000+09:00",
        staleAfterDays: 90,
        items: [
          { label: "어린이 2시간", amount: 15000, currency: "KRW", unit: "child/2h" },
          { label: "보호자 입장", amount: 4000, currency: "KRW", unit: "guardian" }
        ],
        sourceUrl: "https://example.com/prices"
      },
      sources: [{ sourceType: "official_site", url: "https://example.com/prices" }]
    });
    const invalidDate = updatePlaceSchema.safeParse({
      pricing: { summary: "어린이 15,000원", basisDate: "2026-02-30" },
      sources: [{ sourceType: "official_site", url: "https://example.com/prices" }]
    });

    expect(result.pricing?.summary).toBe("어린이 2시간 15,000원, 보호자 4,000원");
    expect(result.pricing?.items?.[0]?.amount).toBe(15000);
    expect(invalidDate.success).toBe(false);
  });

  it("defaults search pagination and keeps facility preferences soft", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      playgroundOnly: true,
      kidsCafeOnly: true,
      preferences: {
        strollerFriendly: true,
        babyChair: true
      }
    });

    expect(result.limit).toBe(20);
    expect(result.radiusKm).toBe(80);
    expect(result.playgroundOnly).toBe(true);
    expect(result.kidsCafeOnly).toBe(true);
    expect(result.preferences?.strollerFriendly).toBe(true);
    expect(result.preferences?.babyChair).toBe(true);
  });

  it("accepts required preference search mode", () => {
    const result = searchPlacesSchema.parse({
      preferenceMode: "required",
      preferences: {
        babyChair: true,
        nursingRoom: true
      }
    });
    const invalid = searchPlacesSchema.safeParse({
      preferenceMode: "strict"
    });

    expect(result.preferenceMode).toBe("required");
    expect(invalid.success).toBe(false);
  });

  it("accepts taxonomy search facets with soft mode by default", () => {
    const result = searchPlacesSchema.parse({
      taxonomy: {
        activityTypes: ["sand_play"],
        logisticsTags: ["stroller"]
      }
    });
    const required = searchPlacesSchema.parse({
      taxonomy: {
        mode: "required",
        visitUseCases: ["rainy_day"]
      }
    });
    const invalid = searchPlacesSchema.safeParse({
      taxonomy: {
        activityTypes: ["made_up_facet"]
      }
    });

    expect(result.taxonomy?.mode).toBe("soft");
    expect(result.taxonomy?.activityTypes).toEqual(["sand_play"]);
    expect(required.taxonomy?.mode).toBe("required");
    expect(invalid.success).toBe(false);
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

  it("accepts visible map viewport bounds for search", () => {
    const result = searchPlacesSchema.parse({
      origin: { lat: 36.35, lng: 127.38 },
      filterByRadius: false,
      viewportBounds: {
        minLat: 36.3,
        minLng: 127.3,
        maxLat: 36.4,
        maxLng: 127.5
      }
    });
    const invertedLat = searchPlacesSchema.safeParse({
      viewportBounds: {
        minLat: 36.4,
        minLng: 127.3,
        maxLat: 36.3,
        maxLng: 127.5
      }
    });
    const invertedLng = searchPlacesSchema.safeParse({
      viewportBounds: {
        minLat: 36.3,
        minLng: 127.5,
        maxLat: 36.4,
        maxLng: 127.3
      }
    });

    expect(result.viewportBounds).toEqual({
      minLat: 36.3,
      minLng: 127.3,
      maxLat: 36.4,
      maxLng: 127.5
    });
    expect(invertedLat.success).toBe(false);
    expect(invertedLng.success).toBe(false);
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

  it("accepts optional course planning mode for agent search calls", () => {
    const result = searchPlacesSchema.parse({
      query: "주말 반나절",
      coursePlan: true
    });

    expect(result.coursePlan).toBe(true);
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

  it("requires explicit confirmation details for delete requests", () => {
    const result = deletePlaceSchema.parse({
      confirmation: "close_place",
      confirmName: "테스트 장소",
      changeSummary: "사용자 요청으로 검색에서 제외한다.",
      sources: [{ sourceType: "user_observation", externalId: "delete-request-20260522" }]
    });
    const missingSummary = deletePlaceSchema.safeParse({
      confirmation: "close_place",
      confirmName: "테스트 장소",
      sources: [{ sourceType: "user_observation", externalId: "delete-request-20260522" }]
    });
    const wrongToken = deletePlaceSchema.safeParse({
      confirmation: "delete_forever",
      confirmName: "테스트 장소",
      changeSummary: "사용자 요청으로 검색에서 제외한다.",
      sources: [{ sourceType: "user_observation", externalId: "delete-request-20260522" }]
    });

    expect(result.actor).toBe("agent");
    expect(result.confirmation).toBe("close_place");
    expect(missingSummary.success).toBe(false);
    expect(wrongToken.success).toBe(false);
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

  it("accepts lodging parent-child related-place metadata", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "official_site", url: "https://example.com/resort/kids-club" }],
      relatedPlaceMode: "append",
      relatedPlaces: [
        {
          placeId: "0de41daa-38bc-48d4-973c-57ab418fa6ef",
          relationType: "parent_child",
          note: "비발디파크 숙박 베이스와 보노 키즈클럽을 상위/부속 관계로 연결.",
          evidence: {
            parentPlaceRole: "lodging_base",
            childVenueRole: "child_primary_indoor_play",
            sameSiteName: "Vivaldi Park",
            sourceUrls: ["https://example.com/resort/kids-club"],
            displayNote: "숙박은 부모 물류 베이스, 키즈클럽은 별도 놀이 목적지로 노출한다."
          }
        },
        {
          placeId: "28a51709-3c3c-4f98-b303-82457256ed3d",
          relationType: "same_site",
          note: "같은 리조트 안에 있지만 명확한 상하위보다는 같은 사이트 관계.",
          evidence: {
            sameSiteName: "Example Resort",
            sourceUrls: ["https://example.com/resort/family"]
          }
        }
      ]
    });

    expect(result.relatedPlaceMode).toBe("append");
    expect(result.relatedPlaces?.[0]).toMatchObject({
      relationType: "parent_child",
      evidence: {
        parentPlaceRole: "lodging_base",
        childVenueRole: "child_primary_indoor_play",
        sameSiteName: "Vivaldi Park"
      }
    });
    expect(result.relatedPlaces?.[1]?.relationType).toBe("same_site");
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

  it("accepts route-support metadata for transport terminals and route breaks", () => {
    const result = updatePlaceSchema.parse({
      sources: [{ sourceType: "public_agency", url: "https://example.com/airport/baby-care" }],
      routeSupport: {
        terminalType: "airport",
        routeSupportRole: "primary_terminal",
        accessArea: "both",
        babyCareLocations: [
          {
            label: "1층 국내선 유아휴게실",
            floor: "1F",
            area: "landside",
            gate: "Domestic arrivals",
            nursingRoom: "yes",
            diaperChangingTable: "yes",
            strollerFriendly: "partial",
            sourceUrl: "https://example.com/airport/baby-care"
          }
        ],
        strollerRental: {
          available: "partial",
          locations: ["안내데스크"],
          notes: "수량과 운영 시간은 현장 확인 필요.",
          sourceUrl: "https://example.com/airport/baby-care"
        },
        prioritySupport: {
          securityFastTrack: "unknown",
          priorityBoarding: "partial",
          notes: "항공사/노선별 조건 확인 필요."
        },
        notes: "공항 route-break용 구조화 기록."
      }
    });
    const invalidArea = updatePlaceSchema.safeParse({
      sources: [{ sourceType: "public_agency", url: "https://example.com/airport/baby-care" }],
      routeSupport: {
        terminalType: "airport",
        babyCareLocations: [{ label: "미확인 휴게실", area: "before_security" }]
      }
    });

    expect(result.routeSupport).toMatchObject({
      terminalType: "airport",
      routeSupportRole: "primary_terminal",
      babyCareLocations: [
        {
          label: "1층 국내선 유아휴게실",
          nursingRoom: "yes",
          diaperChangingTable: "yes"
        }
      ],
      strollerRental: {
        available: "partial",
        locations: ["안내데스크"]
      }
    });
    expect(invalidArea.success).toBe(false);
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
