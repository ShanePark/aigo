import type {
  SearchResultBadgeOpeningHoursSummary,
  SearchResultBadgeRecommendationReadiness,
  SearchResultBadgeSourceSummary
} from "@/app/search-result-badges";

const RESULT_CARD_PLAY_FEATURE_LABELS: Record<string, string> = {
  slide: "미끄럼틀",
  swing: "그네",
  seesaw: "시소",
  babySwing: "영아그네",
  sandPlay: "모래놀이",
  waterPlayground: "물놀이터",
  climbing: "클라이밍",
  trampoline: "트램폴린",
  rideOnToys: "승용완구",
  playHouse: "놀이집"
};

export type SearchItem = {
  distanceKm: number | null;
  facilities: {
    babyChair: string;
    diaperChangingTable: string;
    elevator?: string;
    indoorType: string;
    nursingRoom: string;
    parkingAvailable: string;
    strollerFriendly: string;
  };
  lat: number;
  lng: number;
  name: string;
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary;
  placeId: string;
  playFeatures?: Record<string, unknown> | null;
  pricing?: unknown;
  primaryCategory: string;
  primaryImage?: {
    url: string;
  } | null;
  recommendationReadiness?: SearchResultBadgeRecommendationReadiness | null;
  score: number;
  sourceSummary: SearchResultBadgeSourceSummary;
  tags: string[];
  visit?: {
    childEngagementLevel?: number | null;
    parentEffortLevel?: number | null;
  };
};

export type WeekendPlannerLane = {
  key: string;
  label: string;
  place: SearchItem | null;
  signals: string[];
};

export function weekendPlannerLanes(items: SearchItem[]): WeekendPlannerLane[] {
  const usedPlaceIds = new Set<string>();
  const laneConfigs = [
    { key: "stableIndoor", label: "실내 안정형", score: stableIndoorPlannerScore },
    { key: "activeToddler", label: "첫째 활동량", score: activeToddlerPlannerScore },
    { key: "twinInfant", label: "쌍둥이 동선", score: twinInfantPlannerScore },
    { key: "planningChecks", label: "비용/예약 확인", score: planningCheckPlannerScore },
    { key: "rainyFallback", label: "비 올 때 대안", score: rainyFallbackPlannerScore },
    { key: "shortOutdoor", label: "짧은 야외", score: shortOutdoorPlannerScore }
  ];

  return laneConfigs.map((config) => {
    const place = pickPlannerPlace(items, usedPlaceIds, config.score);
    if (place) usedPlaceIds.add(place.placeId);
    return {
      key: config.key,
      label: config.label,
      place,
      signals: place ? plannerSignals(place, config.key) : []
    };
  });
}

export function plannerMetaLabel(place: SearchItem) {
  return `${categoryLabel(place.primaryCategory)} · 추천 ${place.score}`;
}

function pickPlannerPlace(items: SearchItem[], usedPlaceIds: Set<string>, score: (place: SearchItem) => number) {
  const ranked = items
    .map((place) => ({ place, score: score(place) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.place.score - a.place.score);

  return ranked.find((candidate) => !usedPlaceIds.has(candidate.place.placeId))?.place ?? ranked[0]?.place ?? null;
}

function stableIndoorPlannerScore(place: SearchItem) {
  const indoorBonus = ["indoor", "mixed"].includes(place.facilities.indoorType) ? 30 : 0;
  const readinessBonus = place.recommendationReadiness?.readyForWeekendRecommendation ? 16 : 0;
  if (indoorBonus === 0) return 0;
  return indoorBonus + readinessBonus + place.score / 10;
}

function activeToddlerPlannerScore(place: SearchItem) {
  const engagementScore = (place.visit?.childEngagementLevel ?? 0) * 12;
  const playFeatureScore = positivePlayFeatureKeywords(place).length * 8;
  if (engagementScore === 0 && playFeatureScore === 0) return 0;
  return engagementScore + playFeatureScore + place.score / 10;
}

function twinInfantPlannerScore(place: SearchItem) {
  const logistics = [
    place.facilities.strollerFriendly,
    place.facilities.nursingRoom,
    place.facilities.diaperChangingTable,
    place.facilities.babyChair,
    place.facilities.elevator,
    place.facilities.parkingAvailable
  ];
  const logisticsScore = logistics.reduce((total, value) => total + (value === "yes" ? 10 : value === "partial" ? 5 : 0), 0);
  if (logisticsScore === 0) return 0;
  return logisticsScore + place.score / 10;
}

function planningCheckPlannerScore(place: SearchItem) {
  const readiness = place.recommendationReadiness;
  if (!readiness) return 0;
  const hasPriceCheck = readiness.cautionNotes.some((note) => note.includes("가격"));
  const hasVisitCheck = readiness.blockingGaps.some((gap) => ["reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"].includes(gap));
  const hasImageCheck = readiness.blockingGaps.includes("primaryImage");
  if (!hasPriceCheck && !hasVisitCheck && !hasImageCheck) return 0;
  return (hasPriceCheck ? 24 : 0) + (hasVisitCheck ? 28 : 0) + (hasImageCheck ? 8 : 0) + place.score / 10;
}

function rainyFallbackPlannerScore(place: SearchItem) {
  const indoorBonus = place.facilities.indoorType === "indoor" ? 34 : place.facilities.indoorType === "mixed" ? 22 : 0;
  const cautionPenalty = place.recommendationReadiness?.readyForWeekendRecommendation ? 0 : -6;
  if (indoorBonus === 0) return 0;
  return indoorBonus + cautionPenalty + place.score / 10;
}

function shortOutdoorPlannerScore(place: SearchItem) {
  const outdoorBonus = place.primaryCategory === "park" || place.facilities.indoorType === "outdoor" ? 30 : 0;
  const distanceBonus = place.distanceKm === null ? 2 : Math.max(0, 16 - place.distanceKm);
  if (outdoorBonus === 0) return 0;
  if (place.distanceKm !== null && place.distanceKm > 18) return 0;
  return outdoorBonus + distanceBonus + place.score / 12;
}

function plannerSignals(place: SearchItem, laneKey: string) {
  const signals = new Set<string>();
  const readiness = place.recommendationReadiness;

  if (laneKey === "planningChecks") {
    if (readiness?.blockingGaps.some((gap) => ["reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"].includes(gap))) {
      signals.add("예약 확인");
    }
    if (readiness?.cautionNotes.some((note) => note.includes("가격"))) signals.add("가격 확인");
    if (readiness?.blockingGaps.includes("primaryImage")) signals.add("대표 이미지 없음");
  }

  if (laneKey === "twinInfant") {
    for (const signal of positiveFacilityKeywords(place)) signals.add(signal);
  }

  if (laneKey === "activeToddler") {
    for (const signal of positivePlayFeatureKeywords(place)) signals.add(signal);
    if ((place.visit?.childEngagementLevel ?? 0) >= 4) signals.add("활동량 높음");
  }

  if (laneKey === "rainyFallback") signals.add(place.facilities.indoorType === "mixed" ? "실내외" : "실내");
  if (laneKey === "stableIndoor") {
    signals.add(place.facilities.indoorType === "mixed" ? "실내외" : "실내");
    if (readiness?.readyForWeekendRecommendation) signals.add("바로 비교 가능");
  }
  if (laneKey === "shortOutdoor") signals.add(distanceLabel(place.distanceKm));

  if (signals.size === 0) {
    signals.add(categoryLabel(place.primaryCategory));
  }

  return Array.from(signals).slice(0, 3);
}

function positivePlayFeatureKeywords(place: SearchItem) {
  return Object.entries(RESULT_CARD_PLAY_FEATURE_LABELS)
    .filter(([key]) => positivePlayFeatureValue(place.playFeatures?.[key]))
    .map(([, label]) => label);
}

function positivePlayFeatureValue(value: unknown) {
  return value === "yes" || value === "partial" || value === true;
}

function positiveFacilityKeywords(place: SearchItem) {
  const facilities = [
    [place.facilities.parkingAvailable, "주차"],
    [place.facilities.strollerFriendly, "유모차"],
    [place.facilities.nursingRoom, "수유실"],
    [place.facilities.diaperChangingTable, "기저귀"],
    [place.facilities.babyChair, "아기의자"]
  ];

  return facilities.filter(([value]) => value === "yes").map(([, label]) => String(label));
}

function distanceLabel(value: number | null) {
  return value === null ? "거리 미계산" : `${value.toFixed(1)}km`;
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    kids_cafe: "키즈카페",
    indoor_playground: "실내놀이터",
    toy_store: "장난감 가게",
    toy_library: "장난감도서관",
    library: "도서관",
    museum: "박물관/미술관",
    science_museum: "과학관",
    experience_center: "체험관",
    aquarium_zoo: "동물/아쿠아리움",
    park: "공원/놀이터",
    family_cafe: "가족 카페",
    family_restaurant: "놀이방/가족 식당",
    sports_venue: "스포츠/야구장",
    shopping_mall: "쇼핑/몰",
    rest_area: "휴게소/쉼터",
    accommodation: "키즈 숙소"
  };
  return labels[value] ?? value;
}
