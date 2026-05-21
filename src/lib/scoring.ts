import type { Place } from "@/db/schema";
import type { SearchPlacesInput } from "@/lib/schemas";

type ScoreablePlace = Pick<
  Place,
  | "primaryCategory"
  | "tags"
  | "dataConfidence"
  | "minRecommendedAgeMonths"
  | "maxRecommendedAgeMonths"
  | "indoorType"
  | "parkingAvailable"
  | "strollerFriendly"
  | "nursingRoom"
  | "diaperChangingTable"
  | "kidsToilet"
  | "elevator"
  | "babyChair"
> & {
  distanceKm?: number | null;
};

const confidenceScore: Record<string, number> = {
  official_verified: 5,
  operator_curated: 4,
  agent_collected: 2,
  user_reported: 1,
  unknown: 0,
  needs_check: -2
};

export function scorePlace(place: ScoreablePlace, input: SearchPlacesInput) {
  const reasonCodes = new Set<string>();
  let score = 40;

  if (input.origin && typeof place.distanceKm === "number") {
    if (place.distanceKm <= 5) {
      score += 16;
      reasonCodes.add("DISTANCE_NEAR");
    } else if (place.distanceKm <= 15) {
      score += 11;
      reasonCodes.add("DISTANCE_REASONABLE");
    } else if (place.distanceKm <= 50) {
      score += 6;
      reasonCodes.add("DISTANCE_DAY_TRIP");
    } else {
      reasonCodes.add("DISTANCE_FAR");
    }
  }

  if (input.primaryCategories?.includes(place.primaryCategory)) {
    score += 10;
    reasonCodes.add("CATEGORY_MATCH");
  }

  const requestedTags = new Set(input.tags ?? []);
  const matchedTags = place.tags.filter((tag) => requestedTags.has(tag));
  if (matchedTags.length > 0) {
    score += Math.min(10, matchedTags.length * 3);
    reasonCodes.add("TAG_MATCH");
  }

  applyAgeSignal(place, input.childAgeMonths, reasonCodes, (delta) => {
    score += delta;
  });

  const indoorTypes = input.preferences?.indoorTypes;
  if (indoorTypes?.length) {
    if (indoorTypes.includes(place.indoorType as never)) {
      score += 8;
      reasonCodes.add("INDOOR_TYPE_MATCH");
    } else if (place.indoorType === "unknown") {
      reasonCodes.add("INDOOR_TYPE_UNKNOWN");
    } else {
      score -= 2;
      reasonCodes.add("INDOOR_TYPE_MISMATCH");
    }
  }

  applyTriStatePreference("parkingAvailable", "PARKING", place.parkingAvailable, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("strollerFriendly", "STROLLER", place.strollerFriendly, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("nursingRoom", "NURSING_ROOM", place.nursingRoom, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("diaperChangingTable", "DIAPER_TABLE", place.diaperChangingTable, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("kidsToilet", "KIDS_TOILET", place.kidsToilet, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("elevator", "ELEVATOR", place.elevator, input, reasonCodes, (delta) => {
    score += delta;
  });
  applyTriStatePreference("babyChair", "BABY_CHAIR", place.babyChair, input, reasonCodes, (delta) => {
    score += delta;
  });

  const confidenceDelta = confidenceScore[place.dataConfidence] ?? 0;
  score += confidenceDelta;
  if (confidenceDelta > 0) reasonCodes.add("DATA_CONFIDENCE_POSITIVE");
  if (confidenceDelta < 0) reasonCodes.add("DATA_CONFIDENCE_LOW");

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasonCodes: Array.from(reasonCodes).sort()
  };
}

function applyAgeSignal(
  place: ScoreablePlace,
  childAgeMonths: number[] | undefined,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void
) {
  if (!childAgeMonths?.length) return;

  const min = place.minRecommendedAgeMonths;
  const max = place.maxRecommendedAgeMonths;

  if (min === null || max === null || min === undefined || max === undefined) {
    reasonCodes.add("AGE_HINT_UNKNOWN");
    return;
  }

  const hasMatch = childAgeMonths.some((age) => age >= min && age <= max);
  if (hasMatch) {
    addScore(14);
    reasonCodes.add("AGE_HINT_MATCH");
  } else {
    addScore(1);
    reasonCodes.add("AGE_HINT_MISMATCH");
  }
}

function applyTriStatePreference(
  key: keyof NonNullable<SearchPlacesInput["preferences"]>,
  codePrefix: string,
  value: string,
  input: SearchPlacesInput,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void
) {
  if (!input.preferences?.[key]) return;

  if (value === "yes") {
    addScore(7);
    reasonCodes.add(`${codePrefix}_YES`);
  } else if (value === "partial") {
    addScore(4);
    reasonCodes.add(`${codePrefix}_PARTIAL`);
  } else if (value === "no") {
    addScore(-2);
    reasonCodes.add(`${codePrefix}_NO`);
  } else {
    reasonCodes.add(`${codePrefix}_UNKNOWN`);
  }
}

