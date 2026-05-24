import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SearchResultTrustBadges, searchResultTrustBadges } from "@/app/search-result-badges";

describe("search result trust badges", () => {
  it("labels strong source provenance, freshness, and structured operation gaps", () => {
    expect(
      searchResultTrustBadges(
        {
          sourceCount: 2,
          bestSourceTier: "official",
          bestSourceType: "official_site",
          latestCheckedAt: "2026-05-22T02:00:00.000Z",
          freshnessStatus: "checked_today"
        },
        {
          sourceBacked: true,
          structuredDataGaps: ["openingHours", "walkInAvailable"]
        }
      ).map((badge) => badge.label)
    ).toEqual(["공식 출처", "오늘 확인", "운영정보 보완"]);
  });

  it("renders source-less and stale records as visible SSR badges", () => {
    const html = renderToStaticMarkup(
      createElement(SearchResultTrustBadges, {
        sourceSummary: {
          sourceCount: 0,
          bestSourceTier: "none",
          bestSourceType: null,
          latestCheckedAt: null,
          freshnessStatus: "unchecked"
        },
        openingHoursSummary: {
          sourceBacked: false,
          structuredDataGaps: []
        }
      })
    );

    expect(html).toContain("출처 없음");
    expect(html).toContain("확인일 없음");
    expect(html).toContain("출처와 관련도 확인 상태");
  });

  it("marks stale public-listing records as needing recheck", () => {
    const badges = searchResultTrustBadges(
      {
        sourceCount: 1,
        bestSourceTier: "public_listing",
        bestSourceType: "public_listing",
        latestCheckedAt: "2025-01-01T00:00:00.000Z",
        freshnessStatus: "stale"
      },
      {
        sourceBacked: true,
        structuredDataGaps: []
      }
    );

    expect(badges).toMatchObject([
      { label: "공개목록 출처", tone: "neutral" },
      { label: "재확인 필요", tone: "danger" }
    ]);
  });

  it("surfaces paid indoor visit planning, price, and image gaps", () => {
    const badges = searchResultTrustBadges(
      {
        sourceCount: 1,
        bestSourceTier: "official",
        bestSourceType: "official_site",
        latestCheckedAt: "2026-05-23T00:00:00.000Z",
        freshnessStatus: "checked_today"
      },
      {
        sourceBacked: true,
        structuredDataGaps: []
      },
      {
        agentSummary: "핵심 확인값 3개가 비어 있어 검색 결과 문구에 확인 필요 사유를 함께 표시해야 합니다.",
        blockingGaps: ["reservationRequired", "sessionBased", "sameDayAvailabilityKnown", "primaryImage"],
        cautionNotes: ["유료 가능성이 높은 장소라 가격이나 회차 정보를 별도로 확인해야 합니다."],
        readinessMode: "familyWeekend",
        readyForWeekendRecommendation: false
      }
    );

    expect(badges.map((badge) => badge.label)).toEqual(["공식 출처", "오늘 확인", "예약/회차 확인", "가격 확인 필요", "대표 이미지 없음"]);
    expect(badges.at(-1)).toMatchObject({ tone: "danger" });
  });

  it("surfaces playground equipment and infant route gaps", () => {
    const badges = searchResultTrustBadges(
      {
        sourceCount: 1,
        bestSourceTier: "public_agency",
        bestSourceType: "public_agency",
        latestCheckedAt: "2026-05-23T00:00:00.000Z",
        freshnessStatus: "checked_today"
      },
      {
        sourceBacked: true,
        structuredDataGaps: []
      },
      {
        agentSummary: "핵심 확인값 4개가 비어 있어 검색 결과 문구에 확인 필요 사유를 함께 표시해야 합니다.",
        blockingGaps: ["playFeatures", "strollerFriendly", "parkingAvailable", "kidsToilet", "primaryImage"],
        cautionNotes: ["놀이기구, 그늘, 울타리, 바닥, 화장실 근접성 같은 놀이터 장비 정보가 부족해 가까운 후보라도 현장 검증이 필요합니다."],
        readinessMode: "familyWeekend",
        readyForWeekendRecommendation: false
      }
    );

    expect(badges.map((badge) => badge.label)).toEqual(["공공 출처", "오늘 확인", "놀이터 정보 검증", "영아 동선 확인", "대표 이미지 없음"]);
  });
});
