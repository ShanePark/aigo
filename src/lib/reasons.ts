import type { SearchPlacesInput } from "@/lib/schemas";

export type ReasonTone = "positive" | "partial" | "negative" | "unknown" | "neutral";
export type ReasonGroup = "preference" | "age" | "distance" | "context" | "match" | "confidence" | "other";

export type ReasonMetadata = {
  code: string;
  labelKo: string;
  group: ReasonGroup;
  tone: ReasonTone;
  priority: number;
};

type ReasonDefinition = Omit<ReasonMetadata, "code" | "priority"> & {
  basePriority: number;
};

const reasonDefinitions: Record<string, ReasonDefinition> = {
  AGE_HINT_MATCH: { labelKo: "아이 월령 적합", group: "age", tone: "positive", basePriority: 20 },
  AGE_HINT_MISMATCH: { labelKo: "월령은 보조 후보", group: "age", tone: "partial", basePriority: 22 },
  AGE_HINT_UNKNOWN: { labelKo: "권장 월령 미확인", group: "age", tone: "unknown", basePriority: 24 },
  CATEGORY_MATCH: { labelKo: "카테고리 일치", group: "match", tone: "positive", basePriority: 55 },
  TAG_MATCH: { labelKo: "태그 일치", group: "match", tone: "positive", basePriority: 56 },
  QUERY_NAME_EXACT: { labelKo: "검색어와 장소명 정확히 일치", group: "match", tone: "positive", basePriority: 18 },
  QUERY_NAME_MATCH: { labelKo: "장소명에 검색어 포함", group: "match", tone: "positive", basePriority: 19 },
  QUERY_TAG_MATCH: { labelKo: "태그에 검색어 포함", group: "match", tone: "positive", basePriority: 57 },
  QUERY_PLAY_FEATURE_MATCH: { labelKo: "놀이시설 조건 일치", group: "match", tone: "positive", basePriority: 40 },
  QUERY_TEXT_MATCH: { labelKo: "본문/주소에 검색어 포함", group: "match", tone: "positive", basePriority: 58 },
  DATA_CONFIDENCE_POSITIVE: { labelKo: "출처 신뢰도 높음", group: "confidence", tone: "positive", basePriority: 45 },
  DATA_CONFIDENCE_LOW: { labelKo: "출처 확인 필요", group: "confidence", tone: "negative", basePriority: 12 },
  DISTANCE_NEAR: { labelKo: "가까움", group: "distance", tone: "positive", basePriority: 30 },
  DISTANCE_REASONABLE: { labelKo: "적당한 거리", group: "distance", tone: "positive", basePriority: 32 },
  DISTANCE_DAY_TRIP: { labelKo: "당일치기 거리", group: "distance", tone: "partial", basePriority: 34 },
  DISTANCE_FAR: { labelKo: "먼 거리", group: "distance", tone: "negative", basePriority: 16 },
  INDOOR_TYPE_MATCH: { labelKo: "실내 조건 적합", group: "preference", tone: "positive", basePriority: 5 },
  INDOOR_TYPE_MISMATCH: { labelKo: "실내 조건 불일치", group: "preference", tone: "negative", basePriority: 4 },
  INDOOR_TYPE_UNKNOWN: { labelKo: "실내 여부 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  PARKING_YES: { labelKo: "주차 있음", group: "preference", tone: "positive", basePriority: 5 },
  PARKING_PARTIAL: { labelKo: "주차 일부", group: "preference", tone: "partial", basePriority: 5 },
  PARKING_NO: { labelKo: "주차 없음", group: "preference", tone: "negative", basePriority: 4 },
  PARKING_UNKNOWN: { labelKo: "주차 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  STROLLER_YES: { labelKo: "유모차 좋음", group: "preference", tone: "positive", basePriority: 5 },
  STROLLER_PARTIAL: { labelKo: "유모차 일부", group: "preference", tone: "partial", basePriority: 5 },
  STROLLER_NO: { labelKo: "유모차 어려움", group: "preference", tone: "negative", basePriority: 4 },
  STROLLER_UNKNOWN: { labelKo: "유모차 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  NURSING_ROOM_YES: { labelKo: "수유실 있음", group: "preference", tone: "positive", basePriority: 5 },
  NURSING_ROOM_PARTIAL: { labelKo: "수유실 일부", group: "preference", tone: "partial", basePriority: 5 },
  NURSING_ROOM_NO: { labelKo: "수유실 없음", group: "preference", tone: "negative", basePriority: 4 },
  NURSING_ROOM_UNKNOWN: { labelKo: "수유실 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  DIAPER_TABLE_YES: { labelKo: "기저귀 교환 가능", group: "preference", tone: "positive", basePriority: 5 },
  DIAPER_TABLE_PARTIAL: { labelKo: "기저귀 일부 가능", group: "preference", tone: "partial", basePriority: 5 },
  DIAPER_TABLE_NO: { labelKo: "기저귀 교환 없음", group: "preference", tone: "negative", basePriority: 4 },
  DIAPER_TABLE_UNKNOWN: { labelKo: "기저귀 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  KIDS_TOILET_YES: { labelKo: "유아화장실 있음", group: "preference", tone: "positive", basePriority: 5 },
  KIDS_TOILET_PARTIAL: { labelKo: "유아화장실 일부", group: "preference", tone: "partial", basePriority: 5 },
  KIDS_TOILET_NO: { labelKo: "유아화장실 없음", group: "preference", tone: "negative", basePriority: 4 },
  KIDS_TOILET_UNKNOWN: { labelKo: "유아화장실 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  ELEVATOR_YES: { labelKo: "엘리베이터 있음", group: "preference", tone: "positive", basePriority: 5 },
  ELEVATOR_PARTIAL: { labelKo: "엘리베이터 일부", group: "preference", tone: "partial", basePriority: 5 },
  ELEVATOR_NO: { labelKo: "엘리베이터 없음", group: "preference", tone: "negative", basePriority: 4 },
  ELEVATOR_UNKNOWN: { labelKo: "엘리베이터 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  BABY_CHAIR_YES: { labelKo: "아기의자 있음", group: "preference", tone: "positive", basePriority: 5 },
  BABY_CHAIR_PARTIAL: { labelKo: "아기의자 일부", group: "preference", tone: "partial", basePriority: 5 },
  BABY_CHAIR_NO: { labelKo: "아기의자 없음", group: "preference", tone: "negative", basePriority: 4 },
  BABY_CHAIR_UNKNOWN: { labelKo: "아기의자 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  FOOD_ALLOWED_YES: { labelKo: "식사/간식 가능", group: "preference", tone: "positive", basePriority: 5 },
  FOOD_ALLOWED_PARTIAL: { labelKo: "식사/간식 일부", group: "preference", tone: "partial", basePriority: 5 },
  FOOD_ALLOWED_NO: { labelKo: "식사/간식 어려움", group: "preference", tone: "negative", basePriority: 4 },
  FOOD_ALLOWED_UNKNOWN: { labelKo: "식사/간식 미확인", group: "preference", tone: "unknown", basePriority: 6 },
  CONTEXT_AFTER_DAYCARE_NEAR: { labelKo: "하원 후 가까움", group: "context", tone: "positive", basePriority: 35 },
  CONTEXT_AFTER_DAYCARE_WEATHER_SAFE: { labelKo: "날씨 영향 적음", group: "context", tone: "positive", basePriority: 36 },
  CONTEXT_AFTER_DAYCARE_CATEGORY: { labelKo: "하원 후 가기 좋음", group: "context", tone: "positive", basePriority: 37 },
  CONTEXT_AFTER_DAYCARE_KID_PRIMARY: { labelKo: "아이 활동 중심", group: "context", tone: "positive", basePriority: 25 },
  CONTEXT_AFTER_DAYCARE_GENERIC_FAMILY_SPACE: { labelKo: "아이 활동은 약함", group: "context", tone: "partial", basePriority: 28 },
  CONTEXT_NEARBY_NOW_CLOSE: { labelKo: "지금 가까움", group: "context", tone: "positive", basePriority: 30 },
  CONTEXT_NEARBY_NOW_FAR: { labelKo: "지금 가기엔 멂", group: "context", tone: "negative", basePriority: 15 },
  CONTEXT_RAINY_DAY_INDOOR: { labelKo: "비 오는 날 실내", group: "context", tone: "positive", basePriority: 25 },
  CONTEXT_RAINY_DAY_MIXED: { labelKo: "실내외 혼합", group: "context", tone: "partial", basePriority: 27 },
  CONTEXT_RAINY_DAY_OUTDOOR: { labelKo: "비에는 불리", group: "context", tone: "negative", basePriority: 14 },
  CONTEXT_RAINY_DAY_FAR: { labelKo: "비 오는 날엔 멂", group: "context", tone: "negative", basePriority: 15 },
  CONTEXT_RAINY_DAY_KID_PRIMARY: { labelKo: "비 오는 날 아이 활동", group: "context", tone: "positive", basePriority: 24 },
  CONTEXT_HALFDAY_DESTINATION: { labelKo: "반나절 목적지", group: "context", tone: "positive", basePriority: 35 },
  CONTEXT_HALFDAY_DISTANCE: { labelKo: "반나절 거리 적합", group: "context", tone: "positive", basePriority: 36 },
  CONTEXT_HALFDAY_MEAL_SUPPORT: { labelKo: "식사까지 해결", group: "context", tone: "positive", basePriority: 26 },
  CONTEXT_HALFDAY_KID_PRIMARY: { labelKo: "반나절 아이 중심", group: "context", tone: "positive", basePriority: 25 },
  CONTEXT_HALFDAY_INFANT_AMENITY_GAP: { labelKo: "영아 편의 미확인", group: "context", tone: "unknown", basePriority: 18 },
  CONTEXT_DAY_TRIP_DISTANCE: { labelKo: "당일치기 거리 적합", group: "context", tone: "positive", basePriority: 30 },
  CONTEXT_DAY_TRIP_TOO_CLOSE: { labelKo: "당일치기엔 가까움", group: "context", tone: "partial", basePriority: 38 },
  CONTEXT_DAY_TRIP_DESTINATION: { labelKo: "당일치기 목적지", group: "context", tone: "positive", basePriority: 31 },
  CONTEXT_DAY_TRIP_TAG: { labelKo: "근교 나들이 태그", group: "context", tone: "positive", basePriority: 32 }
};

const preferencePrefixes: Array<[keyof NonNullable<SearchPlacesInput["preferences"]>, string]> = [
  ["indoorTypes", "INDOOR_TYPE"],
  ["parkingAvailable", "PARKING"],
  ["strollerFriendly", "STROLLER"],
  ["nursingRoom", "NURSING_ROOM"],
  ["diaperChangingTable", "DIAPER_TABLE"],
  ["kidsToilet", "KIDS_TOILET"],
  ["elevator", "ELEVATOR"],
  ["babyChair", "BABY_CHAIR"],
  ["foodAllowed", "FOOD_ALLOWED"]
];

export function describeReasonCode(code: string, input?: SearchPlacesInput): ReasonMetadata {
  const definition = reasonDefinitions[code] ?? {
    labelKo: code,
    group: "other" as const,
    tone: "neutral" as const,
    basePriority: 90
  };

  return {
    code,
    labelKo: definition.labelKo,
    group: definition.group,
    tone: definition.tone,
    priority: priorityFor(code, definition.basePriority, input)
  };
}

export function describeReasonCodes(codes: string[], input?: SearchPlacesInput) {
  return codes
    .map((code) => describeReasonCode(code, input))
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

function priorityFor(code: string, basePriority: number, input?: SearchPlacesInput) {
  if (!input?.preferences) return basePriority;

  for (const [key, prefix] of preferencePrefixes) {
    const value = input.preferences[key];
    const isSelected = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (isSelected && code.startsWith(`${prefix}_`)) {
      return basePriority;
    }
  }

  if (reasonDefinitions[code]?.group === "preference") {
    return Math.max(basePriority, 65);
  }
  return basePriority;
}
