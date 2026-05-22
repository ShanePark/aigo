export const primaryCategories = [
  "kids_cafe",
  "indoor_playground",
  "toy_store",
  "toy_library",
  "library",
  "museum",
  "science_museum",
  "experience_center",
  "aquarium_zoo",
  "park",
  "family_cafe",
  "family_restaurant",
  "sports_venue",
  "shopping_mall",
  "rest_area",
  "accommodation"
] as const;

export const sourceTypes = [
  "official_site",
  "public_agency",
  "public_tourism",
  "operator_page",
  "public_listing",
  "public_blog",
  "user_observation",
  "agent_observation",
  "official_image_source",
  "public_listing_image_source",
  "public_news_image_source",
  "map_service",
  "geocode",
  "unknown"
] as const;

export const taxonomyFacetFamilies = {
  familyFitGates: ["child_primary", "baby_logistics", "retail_fallback", "route_break", "user_signal"],
  activityTypes: [
    "indoor_play",
    "outdoor_playground",
    "water_play",
    "sand_play",
    "nature_walk",
    "reading_books",
    "toy_borrowing",
    "shopping_browse",
    "meal_play",
    "science_exhibit",
    "culture_exhibit",
    "hands_on_experience",
    "animals_aquarium",
    "lodging_play"
  ],
  visitUseCases: ["after_daycare", "nearby_now", "rainy_day", "weekend_half_day", "day_trip", "hot_day", "cold_day"],
  ageBands: ["infant", "toddler", "preschool", "school_age"],
  logisticsTags: [
    "parking",
    "low_parking_friction",
    "stroller",
    "double_stroller",
    "elevator",
    "nursing_room",
    "diaper_table",
    "kids_toilet",
    "baby_chair",
    "food_support",
    "reservation",
    "session_based"
  ],
  riskTags: ["water_edge", "road_nearby", "steep_path", "crowding", "fire_grill", "current_operation_uncertain", "seasonal_operation", "infant_amenity_gap"]
} as const;

export type PrimaryCategory = (typeof primaryCategories)[number];
export type SourceType = (typeof sourceTypes)[number];
export type TaxonomyFacetFamily = keyof typeof taxonomyFacetFamilies;
export type TaxonomyConfidence = "high" | "medium" | "low";
export type TaxonomyFacetSet = {
  [Key in TaxonomyFacetFamily]: Array<(typeof taxonomyFacetFamilies)[Key][number]>;
};

export type PlaceTaxonomy = {
  schemaVersion: 1;
  sourceBacked: TaxonomyFacetSet;
  inferred: TaxonomyFacetSet & {
    confidence?: TaxonomyConfidence;
    basis?: string;
  };
  migration: {
    legacyTags: string[];
    broadMappedTags: string[];
    unmappedTags: string[];
    normalizedAt?: string;
  };
};

const sourceTypeAliases: Record<string, SourceType> = {
  official: "official_site",
  official_page: "official_site",
  official_site: "official_site",
  operator: "operator_page",
  operator_site: "operator_page",
  operator_page: "operator_page",
  public: "public_agency",
  public_agency: "public_agency",
  public_data: "public_agency",
  public_data_mirror: "public_agency",
  public_tourism: "public_tourism",
  listing: "public_listing",
  public_listing: "public_listing",
  blog: "public_blog",
  public_blog: "public_blog",
  user: "user_observation",
  user_observation: "user_observation",
  agent: "agent_observation",
  agent_observation: "agent_observation",
  official_image: "official_image_source",
  official_image_source: "official_image_source",
  official_library_image_source: "official_image_source",
  public_listing_image: "public_listing_image_source",
  public_listing_image_source: "public_listing_image_source",
  public_news_image: "public_news_image_source",
  public_news_image_source: "public_news_image_source",
  map: "map_service",
  kakao_map: "map_service",
  naver_map: "map_service",
  google_map: "map_service",
  geocode: "geocode",
  unknown: "unknown"
};

const regionSidoAliases: Record<string, string> = {
  대전: "대전광역시",
  충남: "충청남도",
  충북: "충청북도",
  세종: "세종특별자치시",
  강원: "강원특별자치도",
  경남: "경상남도",
  경북: "경상북도",
  전북: "전북특별자치도",
  전남: "전라남도",
  제주: "제주특별자치도"
};

const legacyTagMappings: Record<string, Partial<TaxonomyFacetSet>> = {
  kids: { familyFitGates: ["child_primary"] },
  어린이: { familyFitGates: ["child_primary"] },
  children_playground: { activityTypes: ["outdoor_playground"] },
  어린이놀이터: { activityTypes: ["outdoor_playground"] },
  물놀이터: { activityTypes: ["water_play"], visitUseCases: ["hot_day"] },
  waterPlayground: { activityTypes: ["water_play"], visitUseCases: ["hot_day"] },
  모래놀이: { activityTypes: ["sand_play"] },
  sandPlay: { activityTypes: ["sand_play"] },
  toy_library: { activityTypes: ["toy_borrowing"] },
  toy_store: { familyFitGates: ["retail_fallback"], activityTypes: ["shopping_browse"] },
  놀이방식당: { activityTypes: ["meal_play"] },
  주말당일: { visitUseCases: ["weekend_half_day", "day_trip"] },
  parking: { logisticsTags: ["parking"] },
  stroller: { logisticsTags: ["stroller"] },
  nursingRoom: { logisticsTags: ["nursing_room"] },
  diaperChangingTable: { logisticsTags: ["diaper_table"] },
  babyChair: { logisticsTags: ["baby_chair"] }
};

export function normalizePrimaryCategory(value: string) {
  const normalized = value.trim();
  return isPrimaryCategory(normalized) ? normalized : null;
}

export function normalizeSourceType(value: string) {
  const key = value.trim().replace(/[-\s]+/g, "_").toLowerCase();
  return sourceTypeAliases[key] ?? null;
}

export function normalizeRegionSido(value: string) {
  const trimmed = value.trim();
  return regionSidoAliases[trimmed] ?? trimmed;
}

export function emptyTaxonomyFacetSet(): TaxonomyFacetSet {
  return {
    familyFitGates: [],
    activityTypes: [],
    visitUseCases: [],
    ageBands: [],
    logisticsTags: [],
    riskTags: []
  };
}

export function emptyPlaceTaxonomy(): PlaceTaxonomy {
  return {
    schemaVersion: 1,
    sourceBacked: emptyTaxonomyFacetSet(),
    inferred: emptyTaxonomyFacetSet(),
    migration: {
      legacyTags: [],
      broadMappedTags: [],
      unmappedTags: []
    }
  };
}

export function normalizeLegacyTags(tags: string[]) {
  const facets = emptyTaxonomyFacetSet();
  const broadMappedTags: string[] = [];
  const unmappedTags: string[] = [];

  for (const tag of unique(tags.map((value) => value.trim()).filter(Boolean))) {
    const mapped = legacyTagMappings[tag];
    if (!mapped) {
      unmappedTags.push(tag);
      continue;
    }
    mergeFacetSet(facets, mapped);
    broadMappedTags.push(tag);
  }

  return { facets, broadMappedTags, unmappedTags };
}

export function inferTaxonomyFromPlace(place: {
  primaryCategory: string;
  tags?: string[];
  indoorType?: string;
  strollerFriendly?: string;
  elevator?: string;
  nursingRoom?: string;
  diaperChangingTable?: string;
  kidsToilet?: string;
  babyChair?: string;
  foodAllowed?: string;
  parkingAvailable?: string;
  reservationRequired?: string;
  sessionBased?: string;
}) {
  const inferred = emptyTaxonomyFacetSet();
  const category = normalizePrimaryCategory(place.primaryCategory);
  const tagMapping = normalizeLegacyTags(place.tags ?? []);
  mergeFacetSet(inferred, tagMapping.facets);

  if (category && ["kids_cafe", "indoor_playground", "toy_library", "library", "science_museum", "experience_center", "aquarium_zoo"].includes(category)) {
    inferred.familyFitGates.push("child_primary");
  }
  if (category === "toy_store") {
    inferred.familyFitGates.push("retail_fallback");
    inferred.activityTypes.push("shopping_browse");
  }
  if (category === "rest_area") {
    inferred.familyFitGates.push("route_break");
    inferred.visitUseCases.push("day_trip");
  }
  if (positive(place.strollerFriendly)) inferred.logisticsTags.push("stroller");
  if (positive(place.elevator)) inferred.logisticsTags.push("elevator");
  if (positive(place.nursingRoom)) inferred.logisticsTags.push("nursing_room");
  if (positive(place.diaperChangingTable)) inferred.logisticsTags.push("diaper_table");
  if (positive(place.kidsToilet)) inferred.logisticsTags.push("kids_toilet");
  if (positive(place.babyChair)) inferred.logisticsTags.push("baby_chair");
  if (positive(place.foodAllowed)) inferred.logisticsTags.push("food_support");
  if (positive(place.parkingAvailable)) inferred.logisticsTags.push("parking");
  if (positive(place.reservationRequired)) inferred.logisticsTags.push("reservation");
  if (positive(place.sessionBased)) inferred.logisticsTags.push("session_based");

  return compactFacetSet(inferred);
}

export function inferTaxonomySearchFacets(query: string) {
  const facets = emptyTaxonomyFacetSet();
  const compact = query.replace(/\s+/g, "").toLowerCase();

  if (/모래놀이|모래놀이터/.test(compact)) facets.activityTypes.push("sand_play");
  if (/물놀이|물놀이터|바닥분수/.test(compact)) facets.activityTypes.push("water_play");
  if (/쌍둥이|쌍둥이유모차/.test(compact)) {
    facets.familyFitGates.push("baby_logistics");
    facets.logisticsTags.push("double_stroller", "stroller", "elevator", "parking", "nursing_room", "diaper_table");
  }
  if (/하원|하원후|어린이집끝나고/.test(compact)) facets.visitUseCases.push("after_daycare");
  if (/비오는날|우천|장마/.test(compact)) facets.visitUseCases.push("rainy_day");
  if (/가는길|도중|경로/.test(compact)) {
    facets.familyFitGates.push("route_break");
    facets.visitUseCases.push("day_trip");
  }
  if (/놀이방식당|밥먹고놀기/.test(compact)) facets.activityTypes.push("meal_play");

  return compactFacetSet(facets);
}

function isPrimaryCategory(value: string): value is PrimaryCategory {
  return (primaryCategories as readonly string[]).includes(value);
}

function positive(value: string | undefined) {
  return value === "yes" || value === "partial";
}

function mergeFacetSet(target: TaxonomyFacetSet, source: Partial<TaxonomyFacetSet>) {
  for (const key of Object.keys(taxonomyFacetFamilies) as TaxonomyFacetFamily[]) {
    (target[key] as string[]).push(...((source[key] ?? []) as string[]));
  }
}

function compactFacetSet(facets: TaxonomyFacetSet) {
  return Object.fromEntries(Object.entries(facets).map(([key, values]) => [key, unique(values)])) as TaxonomyFacetSet;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
