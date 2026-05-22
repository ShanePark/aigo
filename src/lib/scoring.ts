import type { Place } from "@/db/schema";
import type { SearchPlacesInput } from "@/lib/schemas";

type VisitScores = {
  averageStayMinutes: number | null;
  parentEffortLevel: number | null;
  childEngagementLevel: number | null;
  rainyDayScore: number | null;
  hotDayScore: number | null;
  coldDayScore: number | null;
};

type PlaceScoringSignals = {
  placeScore: number | null;
  placeScoreRationale: string | null;
  externalRatingScore: number | null;
  externalReviewCount: number | null;
  searchEvidenceScore: number | null;
  scoreSignals: Record<string, unknown>;
  scoreUpdatedAt: string | null;
};

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
  openingHours?: unknown | null;
  visit?: VisitScores;
  scoring?: PlaceScoringSignals;
};

type ScoreComponent =
  | "baseline"
  | "placeQuality"
  | "externalEvidence"
  | "distance"
  | "context"
  | "match"
  | "age"
  | "preferences"
  | "openingHours"
  | "visitFit"
  | "confidence";

export type ScoreBreakdown = Record<ScoreComponent, number> & {
  total: number;
};

type ScoreOptions = {
  now?: Date;
};

const baselineScore = 34;

const confidenceScore: Record<string, number> = {
  official_verified: 4,
  operator_curated: 3,
  agent_collected: 2,
  user_reported: 1,
  unknown: 0,
  needs_check: -3
};

export function scorePlace(place: ScoreablePlace, input: SearchPlacesInput, options: ScoreOptions = {}) {
  const reasonCodes = new Set<string>();
  const breakdown = emptyBreakdown();
  let score = baselineScore;
  breakdown.baseline = baselineScore;

  const addScore = (component: ScoreComponent, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    score += delta;
    breakdown[component] += delta;
  };

  applyPlaceQualitySignal(place, reasonCodes, (delta) => addScore("placeQuality", delta), (delta) => addScore("externalEvidence", delta));

  if (input.origin && typeof place.distanceKm === "number") {
    if (place.distanceKm <= 3) {
      addScore("distance", 14);
      reasonCodes.add("DISTANCE_NEAR");
    } else if (place.distanceKm <= 8) {
      addScore("distance", 11);
      reasonCodes.add("DISTANCE_NEAR");
    } else if (place.distanceKm <= 15) {
      addScore("distance", 8);
      reasonCodes.add("DISTANCE_REASONABLE");
    } else if (place.distanceKm <= 50) {
      addScore("distance", 4);
      reasonCodes.add("DISTANCE_DAY_TRIP");
    } else {
      addScore("distance", -8);
      reasonCodes.add("DISTANCE_FAR");
    }
  }

  applyVisitContextSignal(place, input, reasonCodes, (delta) => addScore("context", delta));

  if (input.primaryCategories?.includes(place.primaryCategory)) {
    addScore("match", 8);
    reasonCodes.add("CATEGORY_MATCH");
  }

  const requestedTags = new Set(input.tags ?? []);
  const matchedTags = place.tags.filter((tag) => requestedTags.has(tag));
  if (matchedTags.length > 0) {
    addScore("match", Math.min(6, matchedTags.length * 2));
    reasonCodes.add("TAG_MATCH");
  }

  applyAgeSignal(place, input.childAgeMonths, reasonCodes, (delta) => addScore("age", delta));

  const indoorTypes = input.preferences?.indoorTypes;
  if (indoorTypes?.length) {
    if (indoorTypes.includes(place.indoorType as never)) {
      addScore("preferences", 8);
      reasonCodes.add("INDOOR_TYPE_MATCH");
    } else if (place.indoorType === "unknown") {
      reasonCodes.add("INDOOR_TYPE_UNKNOWN");
    } else {
      addScore("preferences", -3);
      reasonCodes.add("INDOOR_TYPE_MISMATCH");
    }
  }

  applyTriStatePreference("parkingAvailable", "PARKING", place.parkingAvailable, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("strollerFriendly", "STROLLER", place.strollerFriendly, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("nursingRoom", "NURSING_ROOM", place.nursingRoom, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("diaperChangingTable", "DIAPER_TABLE", place.diaperChangingTable, input, reasonCodes, (delta) =>
    addScore("preferences", delta)
  );
  applyTriStatePreference("kidsToilet", "KIDS_TOILET", place.kidsToilet, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("elevator", "ELEVATOR", place.elevator, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("babyChair", "BABY_CHAIR", place.babyChair, input, reasonCodes, (delta) => addScore("preferences", delta));
  applyTriStatePreference("foodAllowed", "FOOD_ALLOWED", place.foodAllowed, input, reasonCodes, (delta) => addScore("preferences", delta));

  applyOpeningHoursSignal(place.openingHours, input, reasonCodes, (delta) => addScore("openingHours", delta), options.now ?? new Date());
  applyVisitFitSignal(place.visit, input, reasonCodes, (delta) => addScore("visitFit", delta));

  const confidenceDelta = confidenceScore[place.dataConfidence] ?? 0;
  addScore("confidence", confidenceDelta);
  if (confidenceDelta > 0) reasonCodes.add("DATA_CONFIDENCE_POSITIVE");
  if (confidenceDelta < 0) reasonCodes.add("DATA_CONFIDENCE_LOW");

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    reasonCodes: Array.from(reasonCodes).sort(),
    scoreBreakdown: finalizeBreakdown(breakdown, finalScore)
  };
}

function emptyBreakdown(): Record<ScoreComponent, number> {
  return {
    baseline: 0,
    placeQuality: 0,
    externalEvidence: 0,
    distance: 0,
    context: 0,
    match: 0,
    age: 0,
    preferences: 0,
    openingHours: 0,
    visitFit: 0,
    confidence: 0
  };
}

function finalizeBreakdown(breakdown: Record<ScoreComponent, number>, total: number): ScoreBreakdown {
  return {
    baseline: round1(breakdown.baseline),
    placeQuality: round1(breakdown.placeQuality),
    externalEvidence: round1(breakdown.externalEvidence),
    distance: round1(breakdown.distance),
    context: round1(breakdown.context),
    match: round1(breakdown.match),
    age: round1(breakdown.age),
    preferences: round1(breakdown.preferences),
    openingHours: round1(breakdown.openingHours),
    visitFit: round1(breakdown.visitFit),
    confidence: round1(breakdown.confidence),
    total
  };
}

function applyPlaceQualitySignal(
  place: ScoreablePlace,
  reasonCodes: Set<string>,
  addPlaceQuality: (delta: number) => void,
  addExternalEvidence: (delta: number) => void
) {
  const placeScore = normalizeZeroToTen(place.scoring?.placeScore);
  if (placeScore !== null) {
    addPlaceQuality((placeScore - 5) * 4);
    if (placeScore >= 8) reasonCodes.add("PLACE_SCORE_HIGH");
    else if (placeScore >= 6.5) reasonCodes.add("PLACE_SCORE_GOOD");
    else if (placeScore <= 3.5) reasonCodes.add("PLACE_SCORE_LOW");
  }

  const externalRatingScore = normalizeZeroToTen(place.scoring?.externalRatingScore);
  if (externalRatingScore !== null) {
    const reviewWeight = reviewCountWeight(place.scoring?.externalReviewCount);
    addExternalEvidence((externalRatingScore - 5) * 2.2 * reviewWeight);
    if (externalRatingScore >= 7.5) reasonCodes.add("EXTERNAL_REVIEW_POSITIVE");
    else if (externalRatingScore <= 4) reasonCodes.add("EXTERNAL_REVIEW_NEGATIVE");
  }

  const searchEvidenceScore = normalizeZeroToTen(place.scoring?.searchEvidenceScore);
  if (searchEvidenceScore !== null) {
    addExternalEvidence((searchEvidenceScore - 5) * 1.6);
    if (searchEvidenceScore >= 7.5) reasonCodes.add("SEARCH_EVIDENCE_STRONG");
    else if (searchEvidenceScore <= 4) reasonCodes.add("SEARCH_EVIDENCE_WEAK");
  }
}

function reviewCountWeight(reviewCount: number | null | undefined) {
  if (typeof reviewCount !== "number" || reviewCount <= 0) return 0.35;
  return Math.min(1, 0.35 + Math.log10(reviewCount + 1) / 3);
}

function normalizeZeroToTen(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, value));
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

  const matchingCount = childAgeMonths.filter((age) => age >= min && age <= max).length;
  if (matchingCount === childAgeMonths.length) {
    addScore(10);
    reasonCodes.add("AGE_HINT_MATCH");
  } else if (matchingCount > 0) {
    addScore(6);
    reasonCodes.add("AGE_HINT_PARTIAL");
  } else {
    addScore(-4);
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
    addScore(-3);
    reasonCodes.add(`${codePrefix}_NO`);
  } else {
    reasonCodes.add(`${codePrefix}_UNKNOWN`);
  }
}

function applyVisitFitSignal(visit: VisitScores | undefined, input: SearchPlacesInput, reasonCodes: Set<string>, addScore: (delta: number) => void) {
  if (!visit) return;

  const childEngagement = normalizeOneToFive(visit.childEngagementLevel);
  if (childEngagement !== null) {
    addScore((childEngagement - 3) * 3);
    if (childEngagement >= 4) reasonCodes.add("CHILD_ENGAGEMENT_HIGH");
    if (childEngagement <= 2) reasonCodes.add("CHILD_ENGAGEMENT_LOW");
  }

  const parentEffort = normalizeOneToFive(visit.parentEffortLevel);
  if (parentEffort !== null) {
    addScore((3 - parentEffort) * 2);
    if (parentEffort <= 2) reasonCodes.add("PARENT_EFFORT_LOW");
    if (parentEffort >= 4) reasonCodes.add("PARENT_EFFORT_HIGH");
  }

  if (input.visitContext === "rainyDay") {
    const rainyDayScore = normalizeOneToFive(visit.rainyDayScore);
    if (rainyDayScore !== null) {
      addScore((rainyDayScore - 3) * 3);
      if (rainyDayScore >= 4) reasonCodes.add("RAINY_DAY_SCORE_HIGH");
      if (rainyDayScore <= 2) reasonCodes.add("RAINY_DAY_SCORE_LOW");
    }
  }

  if (input.visitContext === "afterDaycare" && typeof visit.averageStayMinutes === "number") {
    if (visit.averageStayMinutes > 0 && visit.averageStayMinutes <= 120) {
      addScore(2);
      reasonCodes.add("STAY_SHORT_FIT");
    } else if (visit.averageStayMinutes >= 240) {
      addScore(-3);
      reasonCodes.add("STAY_TOO_LONG");
    }
  }
}

function normalizeOneToFive(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(5, value));
}

function applyOpeningHoursSignal(
  openingHours: unknown,
  input: SearchPlacesInput,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void,
  now: Date
) {
  if (!hasOpeningHoursData(openingHours)) return;

  const status = openingHoursStatus(openingHours, now);
  const immediateContext = input.visitContext === "nearbyNow" || input.visitContext === "afterDaycare";

  if (status.state === "open") {
    addScore(immediateContext ? 5 : 3);
    reasonCodes.add("OPEN_NOW");
    if (typeof status.closesInMinutes === "number" && status.closesInMinutes <= 45) {
      addScore(-4);
      reasonCodes.add("CLOSING_SOON");
    }
  } else if (status.state === "closed") {
    addScore(immediateContext ? -22 : -10);
    reasonCodes.add("CLOSED_NOW");
  } else {
    reasonCodes.add("OPENING_HOURS_UNKNOWN");
  }
}

type OpeningStatus = {
  state: "open" | "closed" | "unknown";
  closesInMinutes?: number;
};

type OpeningPeriod = {
  days: number[] | null;
  opens: string | null;
  closes: string | null;
  closed: boolean;
};

function openingHoursStatus(openingHours: unknown, now: Date): OpeningStatus {
  if (!isRecord(openingHours)) return { state: "unknown" };

  const explicitStatus = explicitOpeningStatus(openingHours);
  if (explicitStatus) return explicitStatus;

  const periods = collectOpeningPeriods(openingHours);
  if (periods.length === 0) return { state: "unknown" };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  let hasApplicableSchedule = false;

  for (const period of periods) {
    const opens = parseTimeToMinutes(period.opens);
    const closes = parseTimeToMinutes(period.closes);
    if (periodAppliesToDay(period, today) || periodAppliesToDay(period, yesterday)) {
      hasApplicableSchedule = true;
    }
    if (period.closed || opens === null || closes === null || (opens === 0 && closes === 0)) continue;

    const crossesMidnight = closes <= opens;
    if (periodAppliesToDay(period, today)) {
      if (!crossesMidnight && nowMinutes >= opens && nowMinutes < closes) {
        return { state: "open", closesInMinutes: closes - nowMinutes };
      }
      if (crossesMidnight && nowMinutes >= opens) {
        return { state: "open", closesInMinutes: 24 * 60 - nowMinutes + closes };
      }
    }
    if (crossesMidnight && periodAppliesToDay(period, yesterday) && nowMinutes < closes) {
      return { state: "open", closesInMinutes: closes - nowMinutes };
    }
  }

  return hasApplicableSchedule ? { state: "closed" } : { state: "unknown" };
}

function explicitOpeningStatus(openingHours: Record<string, unknown>): OpeningStatus | null {
  if (typeof openingHours.openNow === "boolean") {
    return { state: openingHours.openNow ? "open" : "closed" };
  }
  if (typeof openingHours.isOpen === "boolean") {
    return { state: openingHours.isOpen ? "open" : "closed" };
  }

  const status = [openingHours.status, openingHours.openStatus, openingHours.businessStatus]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  if (status.some((value) => ["open", "open_now", "operating"].includes(value))) return { state: "open" };
  if (status.some((value) => ["closed", "closed_now", "temporarily_closed", "permanently_closed"].includes(value))) return { state: "closed" };
  return null;
}

function collectOpeningPeriods(openingHours: Record<string, unknown>) {
  const periods: OpeningPeriod[] = [];
  addRawPeriods(periods, openingHours.periods);
  addRawPeriods(periods, openingHours.openingHoursSpecification);

  if (isRecord(openingHours.weekly)) {
    for (const [dayKey, dayValue] of Object.entries(openingHours.weekly)) {
      const day = parseDay(dayKey);
      if (day === null) continue;
      if (Array.isArray(dayValue)) {
        for (const entry of dayValue) {
          if (isRecord(entry)) periods.push(periodFromRecord(entry, [day]));
        }
      } else if (isRecord(dayValue)) {
        periods.push(periodFromRecord(dayValue, [day]));
      } else if (typeof dayValue === "string" && dayValue.toLowerCase() === "closed") {
        periods.push({ days: [day], opens: null, closes: null, closed: true });
      }
    }
  }

  return periods;
}

function addRawPeriods(periods: OpeningPeriod[], raw: unknown) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const value of values) {
    if (isRecord(value)) periods.push(periodFromRecord(value));
  }
}

function periodFromRecord(record: Record<string, unknown>, fallbackDays?: number[]): OpeningPeriod {
  const dayValue = record.dayOfWeek ?? record.day ?? record.days;
  const days = parseDays(dayValue) ?? fallbackDays ?? null;
  const opens = stringValue(record.opens ?? record.open ?? record.opensAt ?? record.start);
  const closes = stringValue(record.closes ?? record.close ?? record.closesAt ?? record.end);
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";

  return {
    days,
    opens,
    closes,
    closed: record.closed === true || status === "closed"
  };
}

function parseDays(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const days = value.map(parseDay).filter((day): day is number => day !== null);
    return days.length > 0 ? days : null;
  }
  const day = parseDay(value);
  return day === null ? null : [day];
}

const dayNames: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
};

function parseDay(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/^https?:\/\/schema\.org\//, "");
  return dayNames[normalized] ?? null;
}

function periodAppliesToDay(period: OpeningPeriod, day: number) {
  return period.days === null || period.days.includes(day);
}

function parseTimeToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return Math.min(23 * 60 + 59, hours * 60 + minutes);
}

function hasOpeningHoursData(openingHours: unknown) {
  return isRecord(openingHours) && Object.keys(openingHours).length > 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
