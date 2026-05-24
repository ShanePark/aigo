import type { Place } from "@/db/schema";
import { seoulWallClockParts } from "@/lib/korea-time";
import { distanceSignalForPlace } from "@/lib/recommendation-scoring";
import type { SearchPlacesInput } from "@/lib/schemas";
import { taxonomyFacetFamilies, type PlaceTaxonomy, type TaxonomyFacetFamily } from "@/lib/taxonomy";

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
  pricing?: Record<string, unknown> | null;
  taxonomy?: PlaceTaxonomy | null;
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

const intrinsicScoreInput: SearchPlacesInput = {
  radiusKm: 80,
  preferences: {
    parkingAvailable: true,
    strollerFriendly: true,
    nursingRoom: true,
    kidsToilet: true,
    babyChair: true
  },
  sort: "recommended",
  limit: 20,
  offset: 0
};

const baselineScore = 24;

const confidenceScore: Record<string, number> = {
  official_verified: 3,
  operator_curated: 2,
  agent_collected: 1,
  user_reported: 0,
  unknown: -1,
  needs_check: -4
};
const taxonomyFacetKeys = Object.keys(taxonomyFacetFamilies) as TaxonomyFacetFamily[];

export function scorePlace(place: ScoreablePlace, input: SearchPlacesInput, options: ScoreOptions = {}) {
  return scorePlaceInternal(place, input, options);
}

export function scorePlaceIntrinsic(place: ScoreablePlace, options: ScoreOptions = {}) {
  const result = scorePlaceInternal(place, intrinsicScoreInput, options, {
    includeAge: false,
    includeContext: false,
    includeDistance: false,
    includeMatch: false,
    includeOpeningHours: false,
    includePreferences: true
  });
  const storedPlaceScore = normalizeZeroToTen(place.scoring?.placeScore);
  if (storedPlaceScore === null) return result;

  const evidenceBonus =
    Math.max(0, result.scoreBreakdown.externalEvidence) * 0.7 +
    Math.max(0, result.scoreBreakdown.preferences) * 0.5 +
    Math.max(0, result.scoreBreakdown.visitFit) * 0.5 +
    Math.max(0, result.scoreBreakdown.confidence) * 0.7;
  const intrinsicScore = clampScore(storedPlaceScore * 8.5 + evidenceBonus);

  return {
    ...result,
    score: intrinsicScore,
    scoreBreakdown: {
      ...result.scoreBreakdown,
      total: intrinsicScore
    }
  };
}

function scorePlaceInternal(
  place: ScoreablePlace,
  input: SearchPlacesInput,
  options: ScoreOptions = {},
  mode: {
    includeAge: boolean;
    includeContext: boolean;
    includeDistance: boolean;
    includeMatch: boolean;
    includeOpeningHours: boolean;
    includePreferences: boolean;
  } = {
    includeAge: true,
    includeContext: true,
    includeDistance: true,
    includeMatch: true,
    includeOpeningHours: true,
    includePreferences: true
  }
) {
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
  applyPublicValueSignal(place, reasonCodes, (delta) => addScore("externalEvidence", delta));

  if (mode.includeDistance) {
    applyDistanceSignal(place, input, reasonCodes, (delta) => addScore("distance", delta));
  }

  if (mode.includeContext) {
    applyVisitContextSignal(place, input, reasonCodes, (delta) => addScore("context", delta));
  }

  if (mode.includeMatch) {
    if (input.primaryCategories?.includes(place.primaryCategory)) {
      addScore("match", 6);
      reasonCodes.add("CATEGORY_MATCH");
    }

    const requestedTags = new Set(input.tags ?? []);
    const matchedTags = place.tags.filter((tag) => requestedTags.has(tag));
    if (matchedTags.length > 0) {
      addScore("match", Math.min(4, matchedTags.length * 1.5));
      reasonCodes.add("TAG_MATCH");
    }
    applyTaxonomySignal(place.taxonomy, input.taxonomy, reasonCodes, (delta) => addScore("match", delta));
  }

  if (mode.includeAge) {
    applyAgeSignal(place, input.childAgeMonths, reasonCodes, (delta) => addScore("age", delta));
  }

  if (mode.includePreferences) {
    const indoorTypes = input.preferences?.indoorTypes;
    if (indoorTypes?.length) {
      if (indoorTypes.includes(place.indoorType as never)) {
        addScore("preferences", 5);
        reasonCodes.add("INDOOR_TYPE_MATCH");
      } else if (place.indoorType === "unknown") {
        reasonCodes.add("INDOOR_TYPE_UNKNOWN");
      } else {
        addScore("preferences", -4);
        reasonCodes.add("INDOOR_TYPE_MISMATCH");
      }
    }

    applyTriStatePreference("parkingAvailable", "PARKING", place.parkingAvailable, input, reasonCodes, (delta) => addScore("preferences", delta));
    applyTriStatePreference("strollerFriendly", "STROLLER", place.strollerFriendly, input, reasonCodes, (delta) => addScore("preferences", delta));
    applyTriStatePreference("nursingRoom", "NURSING_ROOM", place.nursingRoom, input, reasonCodes, (delta) => addScore("preferences", delta));
    applyTriStatePreference("kidsToilet", "KIDS_TOILET", place.kidsToilet, input, reasonCodes, (delta) => addScore("preferences", delta));
    applyTriStatePreference("babyChair", "BABY_CHAIR", place.babyChair, input, reasonCodes, (delta) => addScore("preferences", delta));
  }

  if (mode.includeOpeningHours) {
    applyOpeningHoursSignal(place.openingHours, input, reasonCodes, (delta) => addScore("openingHours", delta), options.now ?? new Date());
  }
  applyVisitFitSignal(place.visit, input, reasonCodes, (delta) => addScore("visitFit", delta));
  applyLodgingEvidenceGate(place, reasonCodes, (delta) => addScore("confidence", delta));

  const confidenceDelta = confidenceScore[place.dataConfidence] ?? 0;
  addScore("confidence", confidenceDelta);
  if (confidenceDelta > 0) reasonCodes.add("DATA_CONFIDENCE_POSITIVE");
  if (confidenceDelta < 0) reasonCodes.add("DATA_CONFIDENCE_LOW");

  const finalScore = clampScore(applyEvidenceCaps(score, place, input, options.now ?? new Date()));
  return {
    score: finalScore,
    reasonCodes: Array.from(reasonCodes).sort(),
    scoreBreakdown: finalizeBreakdown(breakdown, finalScore)
  };
}

function applyDistanceSignal(
  place: ScoreablePlace,
  input: SearchPlacesInput,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void
) {
  if (!input.origin || typeof place.distanceKm !== "number") return;

  const signal = distanceSignalForPlace(
    {
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      distanceKm: place.distanceKm
    },
    input
  );
  if (!signal.reasonCode) return;
  addScore(signal.delta);
  reasonCodes.add(signal.reasonCode);
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
    addPlaceQuality((placeScore - 5) * 3.2);
    if (placeScore >= 8) reasonCodes.add("PLACE_SCORE_HIGH");
    else if (placeScore >= 6.5) reasonCodes.add("PLACE_SCORE_GOOD");
    else if (placeScore <= 3.5) reasonCodes.add("PLACE_SCORE_LOW");
  }

  const externalRatingScore = normalizeZeroToTen(place.scoring?.externalRatingScore);
  if (externalRatingScore !== null) {
    const reviewWeight = reviewCountWeight(place.scoring?.externalReviewCount);
    addExternalEvidence((externalRatingScore - 5) * 1.8 * reviewWeight);
    if (externalRatingScore >= 7.5) reasonCodes.add("EXTERNAL_REVIEW_POSITIVE");
    else if (externalRatingScore <= 4) reasonCodes.add("EXTERNAL_REVIEW_NEGATIVE");
  }

  const searchEvidenceScore = normalizeZeroToTen(place.scoring?.searchEvidenceScore);
  if (searchEvidenceScore !== null) {
    addExternalEvidence((searchEvidenceScore - 5) * 1.1);
    if (searchEvidenceScore >= 7.5) reasonCodes.add("SEARCH_EVIDENCE_STRONG");
    else if (searchEvidenceScore <= 4) reasonCodes.add("SEARCH_EVIDENCE_WEAK");
  }
}

function applyPublicValueSignal(place: ScoreablePlace, reasonCodes: Set<string>, addScore: (delta: number) => void) {
  let delta = 0;
  if (hasFreeAdmissionSignal(place)) {
    delta += 3;
    reasonCodes.add("PUBLIC_FREE_ADMISSION");
  } else if (hasLowCostSignal(place)) {
    delta += 1.5;
    reasonCodes.add("PUBLIC_LOW_COST");
  }

  const facilityScale = facilityScaleSignal(place.scoring?.scoreSignals);
  if (facilityScale === "large") {
    delta += 2.5;
    reasonCodes.add("FACILITY_SCALE_LARGE");
  } else if (facilityScale === "medium") {
    delta += 1;
    reasonCodes.add("FACILITY_SCALE_MEDIUM");
  }

  addScore(Math.min(5, delta));
}

function reviewCountWeight(reviewCount: number | null | undefined) {
  if (typeof reviewCount !== "number" || reviewCount <= 0) return 0.35;
  return Math.min(1, 0.35 + Math.log10(reviewCount + 1) / 3);
}

function normalizeZeroToTen(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, value));
}

function hasFreeAdmissionSignal(place: ScoreablePlace) {
  return truthySignal(place.scoring?.scoreSignals?.freeAdmission) || truthySignal(place.scoring?.scoreSignals?.freeEntry) || pricingHasFreeAdmission(place.pricing);
}

function hasLowCostSignal(place: ScoreablePlace) {
  return lowCostSignal(place.scoring?.scoreSignals?.freeAdmission) || lowCostSignal(place.scoring?.scoreSignals?.lowCost) || pricingHasLowCostAdmission(place.pricing);
}

function truthySignal(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(?:yes|true|free|free_admission|무료|무료입장)$/i.test(value.trim());
  if (Array.isArray(value)) return value.some(truthySignal);
  if (isRecord(value)) {
    return ["value", "free", "isFree", "confirmed", "sourceBacked"].some((key) => truthySignal(value[key]));
  }
  return false;
}

function lowCostSignal(value: unknown): boolean {
  if (typeof value === "string") return /(?:low[_\s-]?cost|cheap|affordable|저렴|저비용|공공요금)/i.test(value);
  if (Array.isArray(value)) return value.some(lowCostSignal);
  if (isRecord(value)) {
    return ["value", "level", "type", "cost"].some((key) => lowCostSignal(value[key]));
  }
  return false;
}

function facilityScaleSignal(scoreSignals: Record<string, unknown> | undefined): "large" | "medium" | null {
  const value = scoreSignals?.facilityScale ?? scoreSignals?.scale;
  const tokens = signalTokens(value);
  if (tokens.some((token) => ["large", "very_large", "major", "regional", "destination", "campus", "multi_use", "complex", "broad"].includes(token))) {
    return "large";
  }
  if (tokens.some((token) => ["medium", "moderate"].includes(token))) return "medium";
  return null;
}

function signalTokens(value: unknown): string[] {
  if (typeof value === "string") return [normalizeSignalToken(value)];
  if (Array.isArray(value)) return value.flatMap(signalTokens);
  if (isRecord(value)) {
    return ["value", "level", "type", "scale", "kind"].flatMap((key) => signalTokens(value[key]));
  }
  return [];
}

function normalizeSignalToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pricingHasFreeAdmission(pricing: unknown) {
  const record = isRecord(pricing) ? pricing : null;
  if (!record) return false;
  const text = pricingText(record);
  if (/(?:무료\s*(?:입장|관람|이용)?|입장료\s*무료|free\s*(?:admission|entry)?)/i.test(text)) return true;

  const admissionItems = pricingAdmissionItems(record);
  return admissionItems.length > 0 && admissionItems.every((item) => item.amount === 0);
}

function pricingHasLowCostAdmission(pricing: unknown) {
  const record = isRecord(pricing) ? pricing : null;
  if (!record) return false;
  const text = pricingText(record);
  if (/(?:저렴|저비용|공공요금|low\s*cost|affordable)/i.test(text)) return true;

  const amounts = pricingAdmissionItems(record)
    .map((item) => item.amount)
    .filter((amount): amount is number => typeof amount === "number" && amount > 0);
  return amounts.length > 0 && Math.max(...amounts) <= 5_000;
}

function pricingText(record: Record<string, unknown>) {
  return ["summary", "notes", "sourceTitle"]
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function pricingAdmissionItems(record: Record<string, unknown>) {
  const items = Array.isArray(record.items) ? record.items.filter(isRecord) : [];
  return items.flatMap((item) => {
    const label = [item.label, item.unit, item.notes].filter((value): value is string => typeof value === "string").join(" ");
    const amount = typeof item.amount === "number" && Number.isFinite(item.amount) ? item.amount : null;
    if (amount === null) return [];
    if (!/(?:입장|입장료|이용|관람|admission|entry|ticket|어린이|아동|성인|보호자)/i.test(label)) return [];
    if (/(?:주차|parking)/i.test(label)) return [];
    return [{ amount }];
  });
}

function applyTaxonomySignal(
  taxonomy: PlaceTaxonomy | null | undefined,
  requested: SearchPlacesInput["taxonomy"] | undefined,
  reasonCodes: Set<string>,
  addScore: (delta: number) => void
) {
  if (!requested || !hasRequestedTaxonomyFacets(requested)) return;

  const placeFacets = combinedPlaceTaxonomyFacets(taxonomy);
  let hasUnknownFacetFamily = false;
  for (const family of taxonomyFacetKeys) {
    const requestedValues = requested[family] ?? [];
    if (requestedValues.length === 0) continue;

    const availableValues = placeFacets[family];
    const matchCount = requestedValues.filter((value) => availableValues.has(value)).length;
    if (matchCount === 0) {
      if (availableValues.size === 0) hasUnknownFacetFamily = true;
      continue;
    }

    addScore(taxonomyFacetDelta(family, matchCount));
    reasonCodes.add(taxonomyReasonCode(family));
  }

  if (hasUnknownFacetFamily) {
    reasonCodes.add("TAXONOMY_UNKNOWN");
  }
}

function combinedPlaceTaxonomyFacets(taxonomy: PlaceTaxonomy | null | undefined) {
  const combined = Object.fromEntries(taxonomyFacetKeys.map((family) => [family, new Set<string>()])) as Record<TaxonomyFacetFamily, Set<string>>;
  if (!taxonomy) return combined;

  for (const family of taxonomyFacetKeys) {
    for (const value of taxonomy.sourceBacked?.[family] ?? []) combined[family].add(value);
    for (const value of taxonomy.inferred?.[family] ?? []) combined[family].add(value);
  }
  return combined;
}

function hasRequestedTaxonomyFacets(taxonomy: NonNullable<SearchPlacesInput["taxonomy"]>) {
  return taxonomyFacetKeys.some((family) => (taxonomy[family]?.length ?? 0) > 0);
}

function taxonomyFacetDelta(family: TaxonomyFacetFamily, matchCount: number) {
  switch (family) {
    case "activityTypes":
      return Math.min(6, matchCount * 3);
    case "visitUseCases":
    case "familyFitGates":
      return Math.min(4, matchCount * 2);
    case "logisticsTags":
      return Math.min(5, matchCount * 1.5);
    case "ageBands":
      return Math.min(3, matchCount * 1.5);
    case "riskTags":
      return -2;
    default:
      return 0;
  }
}

function taxonomyReasonCode(family: TaxonomyFacetFamily) {
  switch (family) {
    case "activityTypes":
      return "TAXONOMY_ACTIVITY_MATCH";
    case "logisticsTags":
      return "TAXONOMY_LOGISTICS_MATCH";
    case "riskTags":
      return "TAXONOMY_RISK_FLAG";
    case "familyFitGates":
    case "visitUseCases":
    case "ageBands":
    default:
      return "TAXONOMY_USE_CASE_MATCH";
  }
}

function applyEvidenceCaps(value: number, place: ScoreablePlace, input: SearchPlacesInput, now: Date) {
  const placeScore = normalizeZeroToTen(place.scoring?.placeScore);
  const externalRatingScore = normalizeZeroToTen(place.scoring?.externalRatingScore);
  const searchEvidenceScore = normalizeZeroToTen(place.scoring?.searchEvidenceScore);
  let cap = Number.POSITIVE_INFINITY;

  if (placeScore === null && externalRatingScore === null && searchEvidenceScore === null) cap = Math.min(cap, 88);
  else if (placeScore === null) cap = Math.min(cap, 92);
  else if (externalRatingScore === null) cap = Math.min(cap, 96);

  if (isImmediateVisitContext(input) && openingHoursStatus(place.openingHours, now).state === "unknown") {
    cap = Math.min(cap, input.visitContext === "nearbyNow" ? 82 : 92);
  }

  if (isImmediateKidActivityIntent(input) && isGenericFamilySpace(place.primaryCategory) && !isKidPrimaryPlace(place.primaryCategory, new Set(place.tags))) {
    cap = Math.min(cap, 69);
  }

  if (place.primaryCategory === "accommodation" && lodgingInfantLogisticsKnownCount(place) <= 2) {
    cap = Math.min(cap, 78);
  }

  return Number.isFinite(cap) ? Math.min(value, cap) : value;
}

function applyLodgingEvidenceGate(place: ScoreablePlace, reasonCodes: Set<string>, addScore: (delta: number) => void) {
  if (place.primaryCategory !== "accommodation") return;

  const knownCount = lodgingInfantLogisticsKnownCount(place);
  if (knownCount <= 2) {
    addScore(-6);
    reasonCodes.add("LODGING_INFANT_LOGISTICS_GAP");
  } else if (knownCount >= 5) {
    addScore(2);
    reasonCodes.add("LODGING_INFANT_LOGISTICS_EVIDENCE");
  }
}

function lodgingInfantLogisticsKnownCount(place: ScoreablePlace) {
  return [
    place.parkingAvailable,
    place.strollerFriendly,
    place.nursingRoom,
    place.diaperChangingTable,
    place.elevator,
    place.babyChair,
    place.foodAllowed
  ].filter((value) => value !== "unknown").length;
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
      addScore(5);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_NEAR");
    }
    if (indoor === "indoor" || indoor === "mixed") {
      addScore(3);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_WEATHER_SAFE");
    }
    if (["kids_cafe", "indoor_playground", "toy_library", "toy_store", "library", "family_cafe", "family_restaurant", "shopping_mall"].includes(category)) {
      addScore(4);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_CATEGORY");
    }
    if (isKidPrimaryPlace(category, tags)) {
      addScore(3);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_KID_PRIMARY");
    } else if (category === "family_cafe") {
      addScore(-3);
      reasonCodes.add("CONTEXT_AFTER_DAYCARE_GENERIC_FAMILY_SPACE");
    }
  }

  if (input.visitContext === "nearbyNow") {
    if (distance <= 5) {
      addScore(7);
      reasonCodes.add("CONTEXT_NEARBY_NOW_CLOSE");
    } else if (distance > 15) {
      addScore(-8);
      reasonCodes.add("CONTEXT_NEARBY_NOW_FAR");
    }

    if (isImmediateKidActivityIntent(input)) {
      if (isKidPrimaryPlace(category, tags)) {
        addScore(8);
        reasonCodes.add("CONTEXT_NEARBY_NOW_KID_PRIMARY");
      } else if (isGenericFamilySpace(category)) {
        addScore(-8);
        reasonCodes.add("CONTEXT_NEARBY_NOW_GENERIC_FAMILY_SPACE");
      }
    }
  }

  if (input.visitContext === "rainyDay") {
    if (indoor === "indoor") {
      addScore(7);
      reasonCodes.add("CONTEXT_RAINY_DAY_INDOOR");
    } else if (indoor === "mixed") {
      addScore(3);
      reasonCodes.add("CONTEXT_RAINY_DAY_MIXED");
    } else if (indoor === "outdoor") {
      addScore(-10);
      reasonCodes.add("CONTEXT_RAINY_DAY_OUTDOOR");
    }
    if (distance > 20) {
      addScore(-5);
      reasonCodes.add("CONTEXT_RAINY_DAY_FAR");
    }
    if (isKidPrimaryPlace(category, tags) && (indoor === "indoor" || indoor === "mixed")) {
      addScore(2);
      reasonCodes.add("CONTEXT_RAINY_DAY_KID_PRIMARY");
    }
  }

  if (input.visitContext === "weekendHalfDay") {
    if (["science_museum", "museum", "experience_center", "aquarium_zoo", "park", "shopping_mall", "accommodation"].includes(category)) {
      addScore(5);
      reasonCodes.add("CONTEXT_HALFDAY_DESTINATION");
    }
    if (category === "family_restaurant" && tags.has("놀이방식당")) {
      addScore(3);
      reasonCodes.add("CONTEXT_HALFDAY_MEAL_SUPPORT");
    }
    if (isKidPrimaryPlace(category, tags)) {
      addScore(3);
      reasonCodes.add("CONTEXT_HALFDAY_KID_PRIMARY");
    }
    if (category === "park" && indoor === "outdoor" && (place.nursingRoom === "unknown" || place.diaperChangingTable === "unknown")) {
      addScore(-5);
      reasonCodes.add("CONTEXT_HALFDAY_INFANT_AMENITY_GAP");
    }
    if (distance >= 5 && distance <= 45) {
      addScore(3);
      reasonCodes.add("CONTEXT_HALFDAY_DISTANCE");
    }
  }

  if (input.visitContext === "dayTrip") {
    if (distance >= 15 && distance <= 80) {
      addScore(8);
      reasonCodes.add("CONTEXT_DAY_TRIP_DISTANCE");
    } else if (distance < 15) {
      addScore(-18);
      reasonCodes.add("CONTEXT_DAY_TRIP_TOO_CLOSE");
    }
    if (["science_museum", "museum", "experience_center", "aquarium_zoo", "park", "accommodation"].includes(category)) {
      addScore(5);
      reasonCodes.add("CONTEXT_DAY_TRIP_DESTINATION");
    }
    if (tags.has("주말당일") || tags.has("세종") || tags.has("청주") || tags.has("공주")) {
      addScore(4);
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

function isGenericFamilySpace(category: string) {
  return ["family_cafe", "library", "shopping_mall", "toy_store"].includes(category);
}

function isImmediateVisitContext(input: SearchPlacesInput) {
  return input.visitContext === "nearbyNow" || input.visitContext === "afterDaycare";
}

function isImmediateKidActivityIntent(input: SearchPlacesInput) {
  if (input.visitContext !== "nearbyNow") return false;

  const categories = new Set(input.primaryCategories ?? []);
  if (categories.has("kids_cafe") || categories.has("indoor_playground") || categories.has("toy_library")) return true;

  const query = (input.query ?? "").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  return ["kids", "kid", "키즈", "키즈카페", "어린이", "아이", "실내놀이터", "놀이터"].some((token) => query.includes(token));
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
    addScore(8);
    reasonCodes.add("AGE_HINT_MATCH");
  } else if (matchingCount > 0) {
    addScore(5);
    reasonCodes.add("AGE_HINT_PARTIAL");
  } else {
    addScore(-6);
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
    addScore(3);
    reasonCodes.add(`${codePrefix}_YES`);
  } else if (value === "partial") {
    addScore(1.5);
    reasonCodes.add(`${codePrefix}_PARTIAL`);
  } else if (value === "no") {
    addScore(-4);
    reasonCodes.add(`${codePrefix}_NO`);
  } else {
    reasonCodes.add(`${codePrefix}_UNKNOWN`);
  }
}

function applyVisitFitSignal(visit: VisitScores | undefined, input: SearchPlacesInput, reasonCodes: Set<string>, addScore: (delta: number) => void) {
  if (!visit) return;

  const childEngagement = normalizeOneToFive(visit.childEngagementLevel);
  if (childEngagement !== null) {
    addScore((childEngagement - 3) * 2);
    if (childEngagement >= 4) reasonCodes.add("CHILD_ENGAGEMENT_HIGH");
    if (childEngagement <= 2) reasonCodes.add("CHILD_ENGAGEMENT_LOW");
  }

  const parentEffort = normalizeOneToFive(visit.parentEffortLevel);
  if (parentEffort !== null) {
    addScore((3 - parentEffort) * 1.5);
    if (parentEffort <= 2) reasonCodes.add("PARENT_EFFORT_LOW");
    if (parentEffort >= 4) reasonCodes.add("PARENT_EFFORT_HIGH");
  }

  if (input.visitContext === "rainyDay") {
    const rainyDayScore = normalizeOneToFive(visit.rainyDayScore);
    if (rainyDayScore !== null) {
      addScore((rainyDayScore - 3) * 2);
      if (rainyDayScore >= 4) reasonCodes.add("RAINY_DAY_SCORE_HIGH");
      if (rainyDayScore <= 2) reasonCodes.add("RAINY_DAY_SCORE_LOW");
    }
  }

  if (input.visitContext === "afterDaycare" && typeof visit.averageStayMinutes === "number") {
    if (visit.averageStayMinutes > 0 && visit.averageStayMinutes <= 120) {
      addScore(1.5);
      reasonCodes.add("STAY_SHORT_FIT");
    } else if (visit.averageStayMinutes >= 240) {
      addScore(-4);
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
  const immediateContext = input.visitContext === "nearbyNow" || input.visitContext === "afterDaycare";
  const unknownPenalty = input.visitContext === "nearbyNow" ? -8 : input.visitContext === "afterDaycare" ? -6 : 0;

  if (!hasOpeningHoursData(openingHours)) {
    if (unknownPenalty !== 0) addScore(unknownPenalty);
    reasonCodes.add("OPENING_HOURS_UNKNOWN");
    return;
  }

  const status = openingHoursStatus(openingHours, now);

  if (status.state === "open") {
    addScore(immediateContext ? 4 : 2);
    reasonCodes.add("OPEN_NOW");
    if (typeof status.closesInMinutes === "number" && status.closesInMinutes <= 45) {
      addScore(-4);
      reasonCodes.add("CLOSING_SOON");
    }
  } else if (status.state === "closed") {
    addScore(immediateContext ? -22 : -10);
    reasonCodes.add("CLOSED_NOW");
  } else {
    if (unknownPenalty !== 0) addScore(unknownPenalty);
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

  const nowParts = seoulWallClockParts(now);
  const nowMinutes = nowParts.hours * 60 + nowParts.minutes;
  const today = nowParts.weekday;
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

const koreanDayNames: Record<string, number> = {
  일: 0,
  일요일: 0,
  월: 1,
  월요일: 1,
  화: 2,
  화요일: 2,
  수: 3,
  수요일: 3,
  목: 4,
  목요일: 4,
  금: 5,
  금요일: 5,
  토: 6,
  토요일: 6
};

const unsupportedSpecialDayNames = new Set(["공휴일", "휴일", "holiday", "holidays", "publicholiday", "publicholidays"]);

function parseDay(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) return value;
  if (typeof value !== "string") return null;
  const normalized = value
    .toLowerCase()
    .replace(/^https?:\/\/schema\.org\//, "")
    .replace(/\s+/g, "");
  if (/^[0-6]$/.test(normalized)) return Number(normalized);
  if (unsupportedSpecialDayNames.has(normalized)) return null;
  return dayNames[normalized] ?? koreanDayNames[normalized] ?? null;
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
