// Search candidate collection lives in places.ts; recommendation policies live here.
// Keep product-tuning constants named and close to the rules they explain.
export type RecommendationPlace = {
  name: string;
  primaryCategory: string;
  tags: string[];
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
const relatedChildDestinationCategories = new Set(["kids_cafe", "indoor_playground", "toy_library", "experience_center", "science_museum", "aquarium_zoo"]);
const relatedSupportDestinationCategories = new Set(["toy_store", "family_cafe", "family_restaurant", "library"]);
const relatedChildDestinationTags = new Set(["키즈카페", "실내놀이터", "어린이체험", "어린이박물관", "어린이도서관", "kids", "kidscafe", "indoorplayground"]);
const relatedSupportDestinationTags = new Set(["놀이방식당", "playroom", "토이저러스", "장난감", "유아휴게실"]);

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
