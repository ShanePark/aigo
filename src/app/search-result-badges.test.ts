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
    expect(html).toContain("출처와 최신성");
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
});
