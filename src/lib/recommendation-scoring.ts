// Search candidate collection lives in places.ts; recommendation policies live here.
// Keep product-tuning constants named and close to the rules they explain.
import type { SearchPlacesInput } from "@/lib/schemas";

export type RecommendationPlace = {
  name: string;
  primaryCategory: string;
  tags: string[];
};

export type DistanceScoringPlace = Pick<RecommendationPlace, "primaryCategory" | "tags"> & {
  distanceKm?: number | null;
};

export type RelatedPlaceScoringRow = {
  placeId: string;
  relatedPlaceId: string;
  relationType: string;
  relatedName: string;
  relatedPrimaryCategory: string;
  relatedTags: string[];
};

export type RelatedPlaceScoringSummary = {
  childDestinationWeight: number;
  supportDestinationWeight: number;
  meaningfulCount: number;
  relationTypes: string[];
  categories: string[];
};

const GENERIC_SHOPPING_MALL_BASE_PENALTY = -10;
const DESTINATION_SHOPPING_MALL_BASE_PENALTY = -3;
const RELATED_CHILD_DESTINATION_WEIGHT = 6;
const RELATED_CHILD_DESTINATION_MAX_BONUS = 12;
const RELATED_SUPPORT_DESTINATION_MAX_BONUS = 4;
const RELATED_SUPPORT_DESTINATION_AFTER_CHILD_MAX_BONUS = 3;
const RELATED_PLACE_CLUSTER_BONUS = 1;
const SHOPPING_MALL_TOTAL_MIN_DELTA = -10;
const SHOPPING_MALL_TOTAL_MAX_DELTA = 8;

const destinationShoppingMallNameTerms = ["아울렛", "프리미엄아울렛", "복합쇼핑몰", "스타필드", "타임빌라스"];
const destinationShoppingMallTags = new Set(["outlet", "premiumoutlet", "destinationmall", "complexmall", "아울렛", "복합쇼핑몰"]);
const relatedChildDestinationCategories = new Set([
  "kids_cafe",
  "indoor_playground",
  "playground",
  "toy_library",
  "shared_childcare",
  "experience_center",
  "science_museum",
  "aquarium",
  "zoo"
]);
const relatedSupportDestinationCategories = new Set(["toy_store", "family_cafe", "family_restaurant", "library"]);
const relatedChildDestinationTags = new Set(["키즈카페", "실내놀이터", "어린이체험", "어린이박물관", "어린이도서관", "kids", "kidscafe", "indoorplayground"]);
const relatedSupportDestinationTags = new Set(["놀이방식당", "playroom", "토이저러스", "장난감", "유아휴게실"]);

type DistanceReasonCode = "DISTANCE_NEAR" | "DISTANCE_REASONABLE" | "DISTANCE_DAY_TRIP" | "DISTANCE_FAR";

type DistanceBand = {
  maxKm: number;
  delta: number;
  reasonCode: DistanceReasonCode;
};

type DistanceProfile = {
  id: "nearbyPlayground" | "localMeal" | "kidsCafe" | "shoppingMallDrive" | "localFallback" | "visitDestination" | "stayDestination" | "destination";
  bands: DistanceBand[];
};

const distanceProfiles: Record<DistanceProfile["id"], DistanceProfile> = {
  nearbyPlayground: {
    id: "nearbyPlayground",
    bands: [
      { maxKm: 1.5, delta: 16, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 3, delta: 13, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 5, delta: 6, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 8, delta: -2, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 15, delta: -12, reasonCode: "DISTANCE_FAR" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -24, reasonCode: "DISTANCE_FAR" }
    ]
  },
  localMeal: {
    id: "localMeal",
    bands: [
      { maxKm: 3, delta: 12, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 6, delta: 8, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 10, delta: 3, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 15, delta: -2, reasonCode: "DISTANCE_FAR" },
      { maxKm: 25, delta: -8, reasonCode: "DISTANCE_FAR" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -15, reasonCode: "DISTANCE_FAR" }
    ]
  },
  kidsCafe: {
    id: "kidsCafe",
    bands: [
      { maxKm: 3, delta: 11, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 8, delta: 7, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 15, delta: 3, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 30, delta: -2, reasonCode: "DISTANCE_FAR" },
      { maxKm: 50, delta: -6, reasonCode: "DISTANCE_FAR" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -12, reasonCode: "DISTANCE_FAR" }
    ]
  },
  shoppingMallDrive: {
    id: "shoppingMallDrive",
    bands: [
      { maxKm: 5, delta: 4, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 20, delta: 7, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 35, delta: 3, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 60, delta: -8, reasonCode: "DISTANCE_FAR" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -20, reasonCode: "DISTANCE_FAR" }
    ]
  },
  localFallback: {
    id: "localFallback",
    bands: [
      { maxKm: 3, delta: 9, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 8, delta: 6, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 15, delta: 1, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 30, delta: -4, reasonCode: "DISTANCE_FAR" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -10, reasonCode: "DISTANCE_FAR" }
    ]
  },
  visitDestination: {
    id: "visitDestination",
    bands: [
      { maxKm: 15, delta: 2, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 60, delta: 6, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 120, delta: 5, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: 220, delta: 2, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -4, reasonCode: "DISTANCE_FAR" }
    ]
  },
  stayDestination: {
    id: "stayDestination",
    bands: [
      { maxKm: 30, delta: 1, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 80, delta: 3, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: 180, delta: 4, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: 300, delta: 2, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -3, reasonCode: "DISTANCE_FAR" }
    ]
  },
  destination: {
    id: "destination",
    bands: [
      { maxKm: 8, delta: 2, reasonCode: "DISTANCE_NEAR" },
      { maxKm: 30, delta: 5, reasonCode: "DISTANCE_REASONABLE" },
      { maxKm: 80, delta: 4, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: 150, delta: 0, reasonCode: "DISTANCE_DAY_TRIP" },
      { maxKm: Number.POSITIVE_INFINITY, delta: -5, reasonCode: "DISTANCE_FAR" }
    ]
  }
};

const playgroundIntentCategories = new Set(["park", "playground", "indoor_playground"]);
const shoppingIntentTerms = ["쇼핑몰", "백화점", "아울렛", "몰", "마트"];
const playgroundIntentTerms = ["놀이터", "유아놀이터", "실내놀이터", "물놀이터", "playground"];
const visitIntentTerms = ["방문", "체험", "박물관", "과학관", "아쿠아리움", "동물원", "수목원", "나들이"];
const visitSearchCategories = new Set(["science_museum", "art_museum", "museum", "experience_center", "aquarium", "zoo", "sports_venue"]);
const visitDestinationCategories = new Set(["science_museum", "art_museum", "museum", "experience_center", "aquarium", "zoo", "park", "sports_venue"]);

export function distanceSignalForPlace(place: DistanceScoringPlace, input: SearchPlacesInput) {
  if (!input.origin || typeof place.distanceKm !== "number") {
    return { delta: 0, reasonCode: null as DistanceReasonCode | null, profileId: null as DistanceProfile["id"] | null };
  }

  const profile = distanceProfileFor(place, input);
  const band = profile.bands.find((candidate) => place.distanceKm! <= candidate.maxKm) ?? profile.bands[profile.bands.length - 1];
  return {
    delta: band.delta,
    reasonCode: band.reasonCode,
    profileId: profile.id
  };
}

export function summarizeRelatedPlaceScoringRows(rows: RelatedPlaceScoringRow[]) {
  const summaryMap = new Map<string, RelatedPlaceScoringSummary>();

  for (const row of rows) {
    const summary =
      summaryMap.get(row.placeId) ??
      ({
        childDestinationWeight: 0,
        supportDestinationWeight: 0,
        meaningfulCount: 0,
        relationTypes: [],
        categories: []
      } satisfies RelatedPlaceScoringSummary);
    const contribution = relatedPlaceDestinationContribution(row);
    if (contribution.kind !== "none") {
      summary.meaningfulCount += 1;
      if (contribution.kind === "childDestination") {
        summary.childDestinationWeight += contribution.weight;
      } else {
        summary.supportDestinationWeight += contribution.weight;
      }
    }
    summary.relationTypes.push(row.relationType);
    summary.categories.push(row.relatedPrimaryCategory);
    summaryMap.set(row.placeId, summary);
  }

  return summaryMap;
}

export function shoppingMallRelatedPlaceScoreAdjustment(place: RecommendationPlace, summary?: RelatedPlaceScoringSummary) {
  if (place.primaryCategory !== "shopping_mall") {
    return { delta: 0, shoppingMallBase: 0, relatedPlaces: 0, reasonCodes: [] as string[] };
  }

  const reasonCodes = new Set<string>(["SHOPPING_MALL_BASE_DEEMPHASIZED"]);
  const baseDelta = isDestinationShoppingMall(place) ? DESTINATION_SHOPPING_MALL_BASE_PENALTY : GENERIC_SHOPPING_MALL_BASE_PENALTY;
  const childWeight = summary?.childDestinationWeight ?? 0;
  const supportWeight = summary?.supportDestinationWeight ?? 0;
  let bonus = 0;

  // Mall parent records are easy to over-rank on indoor/parking logistics alone.
  // Related child destinations restore score only when they add real visit value.
  if (childWeight > 0) {
    bonus += Math.min(RELATED_CHILD_DESTINATION_MAX_BONUS, Math.round(childWeight * RELATED_CHILD_DESTINATION_WEIGHT));
    reasonCodes.add("RELATED_CHILD_DESTINATION_BOOST");
  }

  if (supportWeight > 0) {
    const supportBonus =
      childWeight > 0
        ? Math.min(RELATED_SUPPORT_DESTINATION_AFTER_CHILD_MAX_BONUS, Math.ceil(supportWeight))
        : Math.min(RELATED_SUPPORT_DESTINATION_MAX_BONUS, Math.ceil(supportWeight * 2));
    bonus += supportBonus;
    reasonCodes.add("RELATED_SUPPORT_DESTINATION_BOOST");
  }

  if ((summary?.meaningfulCount ?? 0) >= 3) {
    bonus += RELATED_PLACE_CLUSTER_BONUS;
    reasonCodes.add("RELATED_PLACE_CLUSTER_BOOST");
  }

  const delta = Math.max(SHOPPING_MALL_TOTAL_MIN_DELTA, Math.min(SHOPPING_MALL_TOTAL_MAX_DELTA, Math.round(baseDelta + bonus)));
  return {
    delta,
    shoppingMallBase: baseDelta,
    relatedPlaces: delta - baseDelta,
    reasonCodes: Array.from(reasonCodes).sort()
  };
}

function distanceProfileFor(place: DistanceScoringPlace, input: SearchPlacesInput): DistanceProfile {
  const category = place.primaryCategory;
  const tags = new Set(place.tags);

  if (category === "accommodation") return distanceProfiles.stayDestination;
  if (isPlaygroundSearchIntent(input) && playgroundIntentCategories.has(category)) return distanceProfiles.nearbyPlayground;
  if (category === "family_restaurant" && tags.has("놀이방식당")) return distanceProfiles.localMeal;
  if (category === "kids_cafe" || category === "indoor_playground") return distanceProfiles.kidsCafe;
  if (category === "shopping_mall") {
    return isShoppingSearchIntent(input) ? distanceProfiles.shoppingMallDrive : distanceProfiles.localFallback;
  }
  if (visitDestinationCategories.has(category) && (isVisitSearchIntent(input) || input.visitContext === "dayTrip" || input.visitContext === "weekendHalfDay")) {
    return distanceProfiles.visitDestination;
  }
  if (isDestinationCategory(category)) return distanceProfiles.destination;
  if (["family_cafe", "library", "toy_library", "shared_childcare", "toy_store", "family_restaurant"].includes(category)) {
    return distanceProfiles.localFallback;
  }
  return distanceProfiles.destination;
}

function isPlaygroundSearchIntent(input: SearchPlacesInput) {
  return input.playgroundOnly === true || queryIncludes(input, playgroundIntentTerms);
}

function isShoppingSearchIntent(input: SearchPlacesInput) {
  const categories = new Set(input.primaryCategories ?? []);
  return categories.has("shopping_mall") || queryIncludes(input, shoppingIntentTerms);
}

function isVisitSearchIntent(input: SearchPlacesInput) {
  const categories = new Set(input.primaryCategories ?? []);
  return setHasAny(categories, visitSearchCategories) || queryIncludes(input, visitIntentTerms);
}

function isDestinationCategory(category: string) {
  return ["science_museum", "art_museum", "museum", "experience_center", "aquarium", "zoo", "rest_area"].includes(category);
}

function queryIncludes(input: SearchPlacesInput, tokens: string[]) {
  const query = compactSearchText(input.query ?? "");
  return tokens.some((token) => query.includes(compactSearchText(token)));
}

function setHasAny<T>(values: Set<T>, candidates: Set<T>) {
  return Array.from(candidates).some((candidate) => values.has(candidate));
}

function isDestinationShoppingMall(place: Pick<RecommendationPlace, "name" | "tags">) {
  const compactName = compactSearchText(place.name);
  const compactTags = place.tags.map(compactSearchText);
  return (
    destinationShoppingMallNameTerms.some((term) => compactName.includes(term)) ||
    compactTags.some((tag) => destinationShoppingMallTags.has(tag))
  );
}

function relatedPlaceDestinationContribution(row: RelatedPlaceScoringRow) {
  const relationMultiplier = relatedPlaceRelationMultiplier(row.relationType);
  if (relationMultiplier <= 0) return { kind: "none" as const, weight: 0 };

  const category = row.relatedPrimaryCategory;
  const tags = new Set(row.relatedTags.map(compactSearchText));
  if (relatedChildDestinationCategories.has(category) || setIntersects(tags, relatedChildDestinationTags)) {
    return { kind: "childDestination" as const, weight: relationMultiplier };
  }
  if (relatedSupportDestinationCategories.has(category) || setIntersects(tags, relatedSupportDestinationTags)) {
    return { kind: "supportDestination" as const, weight: relationMultiplier * 0.7 };
  }
  return { kind: "none" as const, weight: 0 };
}

function relatedPlaceRelationMultiplier(relationType: string) {
  if (["same_building", "same_site", "parent_child"].includes(relationType)) return 1;
  if (relationType === "nearby") return 0.45;
  return 0;
}

function setIntersects(first: Set<string>, second: Set<string>) {
  return Array.from(second).some((value) => first.has(value));
}

function compactSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}
