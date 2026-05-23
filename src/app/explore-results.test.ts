import { describe, expect, it } from "vitest";

import { weekendPlannerLanes, type SearchItem } from "@/app/weekend-planner";

describe("weekend planner lanes", () => {
  it("selects distinct candidates for practical weekend comparison lanes", () => {
    const lanes = weekendPlannerLanes([
      place({
        name: "대전 어린이회관",
        placeId: "stable",
        facilities: { indoorType: "indoor" },
        recommendationReadiness: readyReadiness(),
        score: 80
      }),
      place({
        name: "트램폴린 키즈카페",
        placeId: "active",
        playFeatures: { trampoline: "yes" },
        visit: { childEngagementLevel: 5 },
        score: 70
      }),
      place({
        name: "유모차 동선 좋은 몰",
        placeId: "infant",
        facilities: {
          babyChair: "yes",
          diaperChangingTable: "yes",
          elevator: "yes",
          nursingRoom: "yes",
          parkingAvailable: "yes",
          strollerFriendly: "yes"
        },
        score: 62
      }),
      place({
        name: "회차 확인 필요한 과학관",
        placeId: "check",
        recommendationReadiness: {
          agentSummary: "예약, 회차, 가격 확인이 필요합니다.",
          blockingGaps: ["reservationRequired", "sessionBased"],
          cautionNotes: ["가격 정보 확인이 필요합니다."],
          readinessMode: "familyWeekend",
          readyForWeekendRecommendation: false
        },
        score: 58
      }),
      place({
        name: "비 오는 날 쇼핑몰",
        placeId: "rain",
        facilities: { indoorType: "mixed" },
        score: 61
      }),
      place({
        name: "가까운 모래놀이터",
        placeId: "outdoor",
        distanceKm: 2.4,
        facilities: { indoorType: "outdoor" },
        primaryCategory: "park",
        score: 56
      })
    ]);

    expect(lanes.map((lane) => lane.label)).toEqual(["실내 안정형", "첫째 활동량", "쌍둥이 동선", "비용/예약 확인", "비 올 때 대안", "짧은 야외"]);
    expect(lanePlaceNames(lanes)).toEqual([
      "대전 어린이회관",
      "트램폴린 키즈카페",
      "유모차 동선 좋은 몰",
      "회차 확인 필요한 과학관",
      "비 오는 날 쇼핑몰",
      "가까운 모래놀이터"
    ]);
    expect(lanes.find((lane) => lane.key === "planningChecks")?.signals).toEqual(expect.arrayContaining(["예약 확인", "가격 확인"]));
    expect(lanes.find((lane) => lane.key === "twinInfant")?.signals).toEqual(expect.arrayContaining(["주차", "유모차", "수유실"]));
  });

  it("keeps lanes empty when items have no matching planning signal", () => {
    const lanes = weekendPlannerLanes([
      place({
        name: "일반 후보",
        placeId: "weak",
        facilities: { indoorType: "unknown" },
        primaryCategory: "museum",
        score: 99
      }),
      place({
        name: "먼 야외 후보",
        placeId: "far-outdoor",
        distanceKm: 59,
        facilities: { indoorType: "outdoor" },
        primaryCategory: "park",
        score: 99
      })
    ]);

    expect(lanes.every((lane) => lane.place === null)).toBe(true);
  });
});

function lanePlaceNames(lanes: ReturnType<typeof weekendPlannerLanes>) {
  return lanes.map((lane) => lane.place?.name ?? null);
}

function place(
  overrides: Partial<Omit<SearchItem, "facilities" | "openingHoursSummary" | "recommendationReadiness" | "sourceSummary">> & {
    facilities?: Partial<SearchItem["facilities"]>;
    openingHoursSummary?: Partial<SearchItem["openingHoursSummary"]>;
    recommendationReadiness?: SearchItem["recommendationReadiness"];
    sourceSummary?: Partial<SearchItem["sourceSummary"]>;
  }
): SearchItem {
  return {
    distanceKm: overrides.distanceKm ?? 5,
    facilities: {
      babyChair: "unknown",
      diaperChangingTable: "unknown",
      elevator: "unknown",
      indoorType: "unknown",
      nursingRoom: "unknown",
      parkingAvailable: "unknown",
      strollerFriendly: "unknown",
      ...overrides.facilities
    },
    lat: overrides.lat ?? 36.3322,
    lng: overrides.lng ?? 127.4341,
    name: overrides.name ?? "후보",
    openingHoursSummary: {
      sourceBacked: true,
      structuredDataGaps: [],
      ...overrides.openingHoursSummary
    },
    placeId: overrides.placeId ?? overrides.name ?? "candidate",
    playFeatures: overrides.playFeatures ?? null,
    pricing: overrides.pricing ?? null,
    primaryCategory: overrides.primaryCategory ?? "museum",
    primaryImage: overrides.primaryImage ?? null,
    recommendationReadiness: overrides.recommendationReadiness ?? null,
    score: overrides.score ?? 50,
    sourceSummary: {
      bestSourceTier: "official",
      bestSourceType: "official_site",
      freshnessStatus: "checked_today",
      latestCheckedAt: "2026-05-23T00:00:00.000Z",
      sourceCount: 1,
      ...overrides.sourceSummary
    },
    tags: overrides.tags ?? [],
    visit: overrides.visit
  };
}

function readyReadiness(): SearchItem["recommendationReadiness"] {
  return {
    agentSummary: "주말 추천에 바로 사용할 수 있습니다.",
    blockingGaps: [],
    cautionNotes: [],
    readinessMode: "familyWeekend",
    readyForWeekendRecommendation: true
  };
}
