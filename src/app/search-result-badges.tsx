import { createElement } from "react";

type SourceTier = "official" | "public_agency" | "operator" | "public_listing" | "other" | "none" | string;
type FreshnessStatus = "checked_today" | "recent" | "aging" | "stale" | "unchecked" | string;

export type SearchResultBadge = {
  key: string;
  label: string;
  title: string;
  tone: "positive" | "neutral" | "warning" | "danger";
};

export type SearchResultBadgeSourceSummary = {
  sourceCount: number;
  bestSourceTier: SourceTier;
  bestSourceType: string | null;
  latestCheckedAt: string | null;
  freshnessStatus: FreshnessStatus;
};

export type SearchResultBadgeOpeningHoursSummary = {
  sourceBacked: boolean;
  structuredDataGaps: string[];
};

type SearchResultTrustBadgesProps = {
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary;
  sourceSummary: SearchResultBadgeSourceSummary;
};

export function SearchResultTrustBadges({ openingHoursSummary, sourceSummary }: SearchResultTrustBadgesProps) {
  const badges = searchResultTrustBadges(sourceSummary, openingHoursSummary);

  return createElement(
    "div",
    { "aria-label": "출처와 최신성", className: "trust-row" },
    badges.map((badge) =>
      createElement(
        "span",
        {
          className: `trust-badge ${badge.tone}`,
          key: badge.key,
          title: badge.title
        },
        badge.label
      )
    )
  );
}

export function searchResultTrustBadges(
  sourceSummary: SearchResultBadgeSourceSummary,
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary
) {
  const badges: SearchResultBadge[] = [sourceTierBadge(sourceSummary), freshnessBadge(sourceSummary)];

  if (openingHoursSummary.sourceBacked && openingHoursSummary.structuredDataGaps.length > 0) {
    badges.push(openingHoursGapBadge(openingHoursSummary.structuredDataGaps));
  }

  return badges;
}

function sourceTierBadge(sourceSummary: SearchResultBadgeSourceSummary): SearchResultBadge {
  const label = sourceTierLabel(sourceSummary.bestSourceTier);
  return {
    key: "source-tier",
    label,
    title:
      sourceSummary.sourceCount > 0
        ? `출처 ${sourceSummary.sourceCount}개. 가장 강한 근거: ${sourceSummary.bestSourceType ?? label}.`
        : "등록된 출처가 없어 목록 단계에서 근거 확인이 필요합니다.",
    tone: sourceSummary.bestSourceTier === "none" ? "danger" : sourceTierTone(sourceSummary.bestSourceTier)
  };
}

function freshnessBadge(sourceSummary: SearchResultBadgeSourceSummary): SearchResultBadge {
  const checkedAt = sourceSummary.latestCheckedAt ? ` 마지막 확인: ${formatDate(sourceSummary.latestCheckedAt)}.` : "";
  return {
    key: "freshness",
    label: freshnessLabel(sourceSummary.freshnessStatus),
    title: `${freshnessTitle(sourceSummary.freshnessStatus)}${checkedAt}`,
    tone: freshnessTone(sourceSummary.freshnessStatus)
  };
}

function openingHoursGapBadge(structuredDataGaps: string[]): SearchResultBadge {
  return {
    key: "opening-hours-gaps",
    label: "운영정보 보완",
    title: `출처에는 운영 정보가 있지만 구조화가 더 필요합니다: ${structuredDataGaps.map(openingHoursGapLabel).join(", ")}.`,
    tone: "warning"
  };
}

function sourceTierLabel(tier: SourceTier) {
  const labels: Record<string, string> = {
    official: "공식 출처",
    public_agency: "공공 출처",
    operator: "운영자 출처",
    public_listing: "공개목록 출처",
    other: "기타 출처",
    none: "출처 없음"
  };
  return labels[tier] ?? "출처 확인";
}

function sourceTierTone(tier: SourceTier): SearchResultBadge["tone"] {
  if (tier === "official" || tier === "public_agency" || tier === "operator") return "positive";
  if (tier === "public_listing" || tier === "other") return "neutral";
  return "danger";
}

function freshnessLabel(status: FreshnessStatus) {
  const labels: Record<string, string> = {
    checked_today: "오늘 확인",
    recent: "최근 확인",
    aging: "재확인 임박",
    stale: "재확인 필요",
    unchecked: "확인일 없음"
  };
  return labels[status] ?? "확인일 점검";
}

function freshnessTitle(status: FreshnessStatus) {
  const labels: Record<string, string> = {
    checked_today: "오늘 확인된 출처가 있습니다.",
    recent: "최근 확인된 출처가 있습니다.",
    aging: "확인일이 오래되어 곧 재확인이 필요합니다.",
    stale: "확인일이 오래되어 방문 전 재확인이 필요합니다.",
    unchecked: "출처 확인일이 기록되지 않았습니다."
  };
  return labels[status] ?? "출처 최신성 상태를 확인하세요.";
}

function freshnessTone(status: FreshnessStatus): SearchResultBadge["tone"] {
  if (status === "checked_today" || status === "recent") return "positive";
  if (status === "aging") return "warning";
  if (status === "stale" || status === "unchecked") return "danger";
  return "neutral";
}

function openingHoursGapLabel(gap: string) {
  const labels: Record<string, string> = {
    openingHours: "운영시간",
    reservationRequired: "예약 필요 여부",
    walkInAvailable: "현장 입장",
    sessionBased: "회차 운영",
    sameDayAvailabilityKnown: "당일 가능 여부"
  };
  return labels[gap] ?? gap;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(date);
}
