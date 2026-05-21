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
  | "foodAllowed"
> & {
  distanceKm?: number | null;
};

const confidenceScore: Record<string, number> = {
  official_verified: 4,
  operator_curated: 3,
  agent_collected: 2,
  user_reported: 1,
  unknown: 0,
  needs_check: -2
};

export function scorePlace(place: ScoreablePlace, input: SearchPlacesInput) {
  const reasonCodes = new Set<string>();
  let score = 25;

  if (input.origin && typeof place.distanceKm === "number") {
    if (place.distanceKm <= 5) {
      score += 12;
      reasonCodes.add("DISTANCE_NEAR");
    } else if (place.distanceKm <= 15) {
      score += 8;
      reasonCodes.add("DISTANCE_REASONABLE");
    } else if (place.distanceKm <= 50) {
      score += 5;
      reasonCodes.add("DISTANCE_DAY_TRIP");
    } else {
      reasonCodes.add("DISTANCE_FAR");
    }
  }

  applyVisitContextSignal(place, input, reasonCodes, (delta) => {
    score += delta;
  });

  if (input.primaryCategories?.includes(place.primaryCategory)) {
    score += 8;
    reasonCodes.add("CATEGORY_MATCH");
  }

  const requestedTags = new Set(input.tags ?? []);
  const matchedTags = place.tags.filter((tag) => requestedTags.has(tag));
  if (matchedTags.length > 0) {
    score += Math.min(6, matchedTags.length * 2);
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
  applyTriStatePreference("foodAllowed", "FOOD_ALLOWED", place.foodAllowed, input, reasonCodes, (delta) => {
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

function applyVisitContextSignal(
  place: ScoreablePlace,
  input: SearchPlacesInput,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void
) {
  if (!input.visitContext) return;

  const category = place.primaryCategory;
  const distance = place.distanceKm ?? Number.POSITIVE_INFINITY;
  const indoor = place.indoorType;
  const tags = new Set(place.tags);

  if (input.visitContext === "afterDaycare") {
    if (distance <= 8) {
      addScore(8);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_NEAR");
    }
    if (indoor === "indoor" || indoor === "mixed") {
      addScore(4);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_WEATHER_SAFE");
    }
    if (["kids_cafe", "indoor_playground", "toy_library", "library", "family_cafe", "family_restaurant", "shopping_mall"].includes(category)) {
      addScore(5);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_CATEGORY");
    }
    if (isKidPrimaryPlace(category, tags)) {
      addScore(4);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_KID_PRIMARY");
    } else if (category === "family_cafe") {
      addScore(-3);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_GENERIC_FAMILY_SPACE");
    }
  }

  if (input.visitContext === "nearbyNow") {
    if (distance <= 5) {
      addScore(10);
      reasonCodes.add("CONTEXT_NEARBY_NOW_CLOSE");
    } else if (distance > 15) {
      addScore(-8);
      reasonCodes.add("CONTEXT_NEARBY_NOW_FAR");
    }
  }

  if (input.visitContext === "rainyDay") {
    if (indoor === "indoor") {
      addScore(10);
      reasonCodes.add("CONTEXT_RAINY_DAY_INDOOR");
    } else if (indoor === "mixed") {
      addScore(5);
      reasonCodes.add("CONTEXT_RAINY_DAY_MIXED");
    } else if (indoor === "outdoor") {
      addScore(-9);
      reasonCodes.add("CONTEXT_RAINY_DAY_OUTDOOR");
    }
    if (distance > 20) {
      addScore(-4);
      reasonCodes.add("CONTEXT_RAINY_DAY_FAR");
    }
    if (isKidPrimaryPlace(category, tags) && (indoor === "indoor" || indoor === "mixed")) {
      addScore(3);
      reasonCodes.add("CONTEXT_RAINY_DAY_KID_PRIMARY");
    }
  }

  if (input.visitContext === "weekendHalfDay") {
    if (["science_museum", "museum", "experience_center", "aquarium_zoo", "park", "shopping_mall"].includes(category)) {
      addScore(7);
      reasonCodes.add("CONTEXT_HALFDAY_DESTINATION");
    }
    if (category === "family_restaurant" && tags.has("놀이방식당")) {
      addScore(4);
      reasonCodes.add("CONTEXT_HALFDAY_MEAL_SUPPORT");
    }
    if (isKidPrimaryPlace(category, tags)) {
      addScore(4);
      reasonCodes.add("CONTEXT_HALFDAY_KID_PRIMARY");
    }
    if (category === "park" && indoor === "outdoor" && (place.nursingRoom === "unknown" || place.diaperChangingTable === "unknown")) {
      addScore(-3);
      reasonCodes.add("CONTEXT_HALFDAY_INFANT_AMENITY_GAP");
    }
    if (distance >= 5 && distance <= 45) {
      addScore(4);
      reasonCodes.add("CONTEXT_HALFDAY_DISTANCE");
    }
  }

  if (input.visitContext === "dayTrip") {
    if (distance >= 15 && distance <= 80) {
      addScore(12);
      reasonCodes.add("CONTEXT_DAY_TRIP_DISTANCE");
    } else if (distance < 8) {
      addScore(-9);
      reasonCodes.add("CONTEXT_DAY_TRIP_TOO_CLOSE");
    }
    if (["science_museum", "museum", "experience_center", "aquarium_zoo", "park"].includes(category)) {
      addScore(7);
      reasonCodes.add("CONTEXT_DAY_TRIP_DESTINATION");
    }
    if (tags.has("주말당일") || tags.has("세종") || tags.has("청주") || tags.has("공주")) {
      addScore(6);
      reasonCodes.add("CONTEXT_DAY_TRIP_TAG");
    }
  }
}

function isKidPrimaryPlace(category: string, tags: Set<string>) {
  return (
    ["kids_cafe", "indoor_playground", "toy_library", "experience_center", "science_museum", "aquarium_zoo"].includes(category) ||
    tags.has("children_museum") ||
    tags.has("children_experience") ||
    tags.has("children_playground") ||
    tags.has("toy_library") ||
    tags.has("어린이") ||
    tags.has("kids")
  );
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
    addScore(10);
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
    addScore(5);
    reasonCodes.add(`${codePrefix}_YES`);
  } else if (value === "partial") {
    addScore(3);
    reasonCodes.add(`${codePrefix}_PARTIAL`);
  } else if (value === "no") {
    addScore(-2);
    reasonCodes.add(`${codePrefix}_NO`);
  } else {
    reasonCodes.add(`${codePrefix}_UNKNOWN`);
  }
}
