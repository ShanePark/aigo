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

export type SearchResultBadgeRecommendationReadiness = {
  agentSummary: string;
  blockingGaps: string[];
  cautionNotes: string[];
  readinessMode: string;
  readyForWeekendRecommendation: boolean;
};

type SearchResultTrustBadgesProps = {
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary;
  recommendationReadiness?: SearchResultBadgeRecommendationReadiness | null;
  sourceSummary: SearchResultBadgeSourceSummary;
};

const visitPlanningGapKeys = new Set(["reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"]);
const playgroundInfantRouteGapKeys = new Set(["strollerFriendly", "parkingAvailable", "kidsToilet", "nursingRoom", "diaperChangingTable"]);

export function SearchResultTrustBadges({ openingHoursSummary, recommendationReadiness, sourceSummary }: SearchResultTrustBadgesProps) {
  const badges = searchResultTrustBadges(sourceSummary, openingHoursSummary, recommendationReadiness);

  return createElement(
    "div",
    { "aria-label": "출처와 관련도 확인 상태", className: "trust-row" },
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
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary,
  recommendationReadiness?: SearchResultBadgeRecommendationReadiness | null
) {
  const badges: SearchResultBadge[] = [sourceTierBadge(sourceSummary), freshnessBadge(sourceSummary)];

  if (openingHoursSummary.sourceBacked && openingHoursSummary.structuredDataGaps.length > 0) {
    badges.push(openingHoursGapBadge(openingHoursSummary.structuredDataGaps));
  }

  badges.push(...recommendationReadinessBadges(recommendationReadiness));

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

function recommendationReadinessBadges(readiness: SearchResultBadgeRecommendationReadiness | null | undefined): SearchResultBadge[] {
  if (!readiness) return [];

  const badges: SearchResultBadge[] = [];
  const visitPlanningGaps = readiness.blockingGaps.filter((gap) => visitPlanningGapKeys.has(gap));
  const playgroundInfantRouteGaps = readiness.blockingGaps.filter((gap) => playgroundInfantRouteGapKeys.has(gap));
  const priceNotes = readiness.cautionNotes.filter((note) => note.includes("가격"));

  if (readiness.blockingGaps.includes("playFeatures")) {
    badges.push({
      key: "playground-feature-gap",
      label: "놀이터 정보 검증",
      title: "놀이기구, 그늘, 울타리, 바닥, 화장실 근접성 같은 장비 정보 보강이 필요합니다.",
      tone: "warning"
    });
  }

  if (playgroundInfantRouteGaps.length > 0) {
    badges.push({
      key: "playground-infant-route-gap",
      label: "영아 동선 확인",
      title: `영아/유모차 동선에 필요한 값이 부족합니다: ${playgroundInfantRouteGaps.map(recommendationGapLabel).join(", ")}.`,
      tone: "warning"
    });
  }

  if (visitPlanningGaps.length > 0) {
    badges.push({
      key: "visit-planning-gaps",
      label: "예약/회차 확인",
      title: `예약, 현장 입장, 회차, 당일 가능 여부 중 확인이 필요합니다: ${visitPlanningGaps.map(openingHoursGapLabel).join(", ")}.`,
      tone: "warning"
    });
  }

  if (priceNotes.length > 0) {
    badges.push({
      key: "pricing-gap",
      label: "가격 확인 필요",
      title: priceNotes.join(" "),
      tone: "warning"
    });
  }

  if (readiness.blockingGaps.includes("primaryImage")) {
    badges.push({
      key: "primary-image-gap",
      label: "대표 이미지 없음",
      title: "검색 결과에서 장소를 빠르게 확인할 대표 이미지 보강이 필요합니다.",
      tone: "danger"
    });
  }

  if (!readiness.readyForWeekendRecommendation && badges.length === 0) {
    badges.push({
      key: "recommendation-readiness-gap",
      label: "관련도 확인 필요",
      title: readiness.agentSummary,
      tone: "warning"
    });
  }

  return badges;
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

function recommendationGapLabel(gap: string) {
  const labels: Record<string, string> = {
    diaperChangingTable: "기저귀갈이대",
    kidsToilet: "유아화장실",
    nursingRoom: "수유실",
    parkingAvailable: "주차",
    strollerFriendly: "유모차 동선"
  };
  return labels[gap] ?? openingHoursGapLabel(gap);
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
