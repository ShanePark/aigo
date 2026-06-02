import { describe, expect, it } from "vitest";

import { getAdminPlacesSummary, getAdminPlacesTotalCount, listAdminPlaceDayCounts, listAdminPlaces } from "@/lib/admin-places";

type QueryResponse = Array<Record<string, unknown>>;

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("admin place listing", () => {
  it("returns recently created places with source and image context", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "테스트 키즈카페",
          primaryCategory: "kids_cafe",
          tags: ["실내", "키즈"],
          description: "아이와 가기 좋은 실내 놀이 공간",
          parentNotes: "주차가 편합니다.",
          safetyNotes: null,
          placeScore: "8.4",
          placeScoreRationale: "실내 놀이와 편의 근거가 확인된 장소.",
          externalRatingScore: null,
          externalReviewCount: null,
          searchEvidenceScore: null,
          scoreSignals: {},
          scoreUpdatedAt: null,
          dataConfidence: "agent_collected",
          minRecommendedAgeMonths: null,
          maxRecommendedAgeMonths: null,
          indoorType: "indoor",
          strollerFriendly: "unknown",
          parkingAvailable: "yes",
          nursingRoom: "unknown",
          diaperChangingTable: "unknown",
          kidsToilet: "unknown",
          elevator: "unknown",
          babyChair: "unknown",
          foodAllowed: "unknown",
          openingHours: null,
          averageStayMinutes: null,
          parentEffortLevel: null,
          childEngagementLevel: null,
          rainyDayScore: null,
          hotDayScore: null,
          coldDayScore: null,
          playFeatures: {},
          taxonomy: null,
          pricing: {},
          imageAltText: "테스트 키즈카페 실내",
          imageUrl: "https://example.com/place.webp",
          createdAt: new Date("2026-06-02T00:00:00.000Z"),
          updatedAt: new Date("2026-06-02T01:00:00.000Z"),
          totalCount: "7"
        }
      ]
    ]);

    await expect(listAdminPlaces({ limit: 10 }, executor)).resolves.toMatchObject({
      items: [
        {
          description: "아이와 가기 좋은 실내 놀이 공간",
          imageAltText: "테스트 키즈카페 실내",
          imageUrl: "https://example.com/place.webp",
          name: "테스트 키즈카페",
          parentNotes: "주차가 편합니다.",
          placeScore: 77,
          primaryCategory: "kids_cafe",
          tags: ["실내", "키즈"]
        }
      ],
      totalCount: 7
    });
    expect(calls[0]).toContain("from places p");
    expect(calls[0]).toContain("from place_images");
    expect(calls[0]).toContain("left join lateral");
    expect(calls[0]).toContain("count(*) over()");
    expect(calls[0]).toContain("p.place_score");
    expect(calls[0]).toContain("p.place_score_rationale");
    expect(calls[0]).toContain("case when ? = 'updated' then p.updated_at else p.created_at end desc");
  });

  it("accepts updated-at sorting for the admin place list", async () => {
    const { calls, executor } = fakeExecutor([[]]);

    await expect(listAdminPlaces({ limit: 10, sort: "updated" }, executor)).resolves.toEqual({ items: [], totalCount: 0 });
    expect(calls[0]).toContain("p.updated_at");
  });

  it("returns the total place count for compact admin context", async () => {
    const { executor } = fakeExecutor([[{ totalCount: "42" }]]);

    await expect(getAdminPlacesTotalCount(executor)).resolves.toEqual({ totalCount: 42 });
  });

  it("filters registered places by Korean calendar date", async () => {
    const { calls, executor } = fakeExecutor([[]]);

    await expect(listAdminPlaces({ date: "2026-06-02", limit: 10 }, executor)).resolves.toEqual({ items: [], totalCount: 0 });
    expect(calls[0]).toContain("(p.created_at at time zone 'Asia/Seoul')::date");
  });

  it("summarizes place registrations by day for a month", async () => {
    const { calls, executor } = fakeExecutor([[{ date: "2026-06-01", count: "2" }, { date: "2026-06-02", count: 5 }]]);

    await expect(listAdminPlaceDayCounts({ month: "2026-06" }, executor)).resolves.toEqual({
      items: [
        { count: 2, date: "2026-06-01" },
        { count: 5, date: "2026-06-02" }
      ]
    });
    expect(calls[0]).toContain("date_trunc('month'");
    expect(calls[0]).toContain("group by date");
  });

  it("summarizes registered places for the admin screen", async () => {
    const { executor } = fakeExecutor([[{ totalCount: 5, activeCount: 4, temporaryClosedCount: 1, sourceBackedCount: 3 }]]);

    await expect(getAdminPlacesSummary(executor)).resolves.toEqual({
      activeCount: 4,
      sourceBackedCount: 3,
      temporaryClosedCount: 1,
      totalCount: 5
    });
  });
});
