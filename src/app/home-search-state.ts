import { hasMapLocationParams } from "@/app/search-url-state";
import { childProfilesToAgeMonths, parseChildAgeMonths, parseChildProfiles } from "@/lib/child-ages";
import type { SearchPlacesInput } from "@/lib/schemas";

export const DEFAULT_ORIGIN = {
  lat: 36.5,
  lng: 127.8,
  label: "전국 지도 중심"
};
export const DEFAULT_RESULT_LIMIT = 50;
export const RESULT_LIMIT_OPTIONS = [50, 100] as const;
export const CATEGORY_GROUP_CATEGORY_FILTERS = {
  all: undefined,
  stay: ["accommodation"],
  visit: ["science_museum", "art_museum", "museum", "experience_center", "aquarium", "zoo", "library", "toy_library", "sports_venue", "rest_area"],
  shopping: ["shopping_mall"],
  toyStore: ["toy_store"],
  playground: ["park", "playground", "indoor_playground"],
  kidsCafe: ["kids_cafe", "family_cafe"],
  playroomDining: ["family_restaurant"]
} as const satisfies Record<string, readonly string[] | undefined>;

export type CategoryGroupId = keyof typeof CATEGORY_GROUP_CATEGORY_FILTERS;

export function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const category = textParam(params.category);
  const categoryGroups = categoryGroupParams(params);
  const groupCategories = categoriesForCategoryGroups(categoryGroups);
  const limit = resultLimitParam(params);
  const page = currentPageParam(params);
  const nearby = textParam(params.nearby) === "1";
  const home = textParam(params.home) === "1";
  const query = textParam(params.query)?.trim();
  const viewportBounds = viewportBoundsFromParams(params);
  const shouldFilterByRadius = viewportBounds ? false : shouldApplyRadiusFilter(params, Boolean(query));
  const radiusKm = Number(textParam(params.radiusKm) || defaultRadiusKmForCategoryGroups(categoryGroups));
  const lat = Number(textParam(params.lat) || DEFAULT_ORIGIN.lat);
  const lng = Number(textParam(params.lng) || DEFAULT_ORIGIN.lng);
  const children = textParam(params.children);
  const ages = children
    ? childProfilesToAgeMonths(parseChildProfiles(children, textParam(params.ages)))
    : parseChildAgeMonths(textParam(params.ages));

  const taxonomyActivityTypes = [
    ...(params.sandPlay === "on" ? (["sand_play"] as const) : []),
    ...(params.waterPlay === "on" ? (["water_play"] as const) : [])
  ];
  const taxonomyAccessTags = [
    ...(params.publicFacility === "on" ? (["public_facility"] as const) : [])
  ];

  return {
    origin: { lat, lng, label: nearby ? "현재 위치" : home ? "집 위치" : viewportBounds ? "지도 중심" : DEFAULT_ORIGIN.label },
    visitContext: (textParam(params.visitContext) || undefined) as SearchPlacesInput["visitContext"],
    radiusKm: shouldFilterByRadius ? radiusKm : undefined,
    filterByRadius: shouldFilterByRadius,
    viewportBounds,
    query: query || undefined,
    primaryCategories: groupCategories ? [...groupCategories] : category ? [category] : undefined,
    playgroundOnly: isSingleCategoryGroup(categoryGroups, "playground") ? true : undefined,
    kidsCafeOnly: isSingleCategoryGroup(categoryGroups, "kidsCafe") ? true : undefined,
    childAgeMonths: ages,
    preferences: {
      indoorTypes: params.indoor === "on" ? ["indoor", "mixed"] : undefined,
      parkingAvailable: params.parking === "on" ? true : undefined,
      toiletNearby: params.toiletNearby === "on" ? true : undefined,
      strollerFriendly: params.stroller === "on" ? true : undefined,
      nursingRoom: params.nursing === "on" ? true : undefined,
      diaperChangingTable: params.diaperChangingTable === "on" ? true : undefined,
      kidsToilet: params.kidsToilet === "on" ? true : undefined,
      babyChair: params.babyChair === "on" ? true : undefined
    },
    taxonomy: taxonomyActivityTypes.length > 0 || taxonomyAccessTags.length > 0
      ? {
          mode: taxonomyAccessTags.length > 0 ? "required" : "soft",
          activityTypes: taxonomyActivityTypes,
          accessTags: taxonomyAccessTags
        }
      : undefined,
    sort: sortParam(params),
    limit,
    offset: Math.min((page - 1) * limit, 1000)
  };
}

export function resultLimitParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.limit) || DEFAULT_RESULT_LIMIT);
  return RESULT_LIMIT_OPTIONS.find((option) => option === requested) ?? DEFAULT_RESULT_LIMIT;
}

export type HomeSearchSort = Extract<SearchPlacesInput["sort"], "recommended" | "distance" | "rating">;

export function sortParam(params: Record<string, string | string[] | undefined>): HomeSearchSort {
  const value = textParam(params.sort);
  if (value === "recommended" || value === "distance" || value === "rating") {
    return value;
  }
  return textParam(params.nearby) === "1" ? "distance" : "recommended";
}

export function shouldAutoLocateInitialMap(params: Record<string, string | string[] | undefined>, hasHomeLocation: boolean) {
  return Boolean(hasHomeLocation && !hasMapLocationParams(params) && !textParam(params.query)?.trim());
}

export function categoryGroupParam(params: Record<string, string | string[] | undefined>): CategoryGroupId {
  return categoryGroupParams(params)[0] ?? "all";
}

export function categoryGroupParams(params: Record<string, string | string[] | undefined>): CategoryGroupId[] {
  const pluralGroups = uniqueCategoryGroups(paramValues(params.categoryGroups).flatMap((value) => value.split(",")));
  if (pluralGroups.length > 0) return pluralGroups;
  const legacyGroups = uniqueCategoryGroups(paramValues(params.categoryGroup).flatMap((value) => value.split(",")));
  return legacyGroups.length > 0 ? legacyGroups : ["all"];
}

export function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentPageParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.page) || 1);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

function hasExplicitLocationParams(params: Record<string, string | string[] | undefined>) {
  return Boolean(
    textParam(params.nearby) === "1" ||
      textParam(params.home) === "1" ||
      textParam(params.lat) ||
      textParam(params.lng) ||
      textParam(params.radiusKm) ||
      viewportBoundsFromParams(params)
  );
}

function shouldApplyRadiusFilter(params: Record<string, string | string[] | undefined>, hasQuery: boolean) {
  if (!hasQuery) return hasExplicitLocationParams(params);
  return textParam(params.nearby) === "1" || textParam(params.home) === "1" || Boolean(textParam(params.radiusKm));
}

function defaultRadiusKmForCategoryGroups(categoryGroups: CategoryGroupId[]) {
  return Math.max(...categoryGroups.map(defaultRadiusKmForCategoryGroup));
}

function defaultRadiusKmForCategoryGroup(categoryGroup: CategoryGroupId) {
  if (categoryGroup === "playground") return 20;
  if (categoryGroup === "visit") return 220;
  if (categoryGroup === "stay") return 300;
  return 80;
}

function categoriesForCategoryGroups(categoryGroups: CategoryGroupId[]) {
  const selected = categoryGroups.filter((group) => group !== "all");
  if (selected.length === 0) return undefined;
  return Array.from(new Set(selected.flatMap((group) => CATEGORY_GROUP_CATEGORY_FILTERS[group] ?? [])));
}

function isSingleCategoryGroup(categoryGroups: CategoryGroupId[], group: CategoryGroupId) {
  return categoryGroups.length === 1 && categoryGroups[0] === group;
}

function uniqueCategoryGroups(values: string[]) {
  const groups: CategoryGroupId[] = [];
  for (const value of values) {
    const group = value.trim();
    if (!group || group === "all") continue;
    if (group in CATEGORY_GROUP_CATEGORY_FILTERS && !groups.includes(group as CategoryGroupId)) {
      groups.push(group as CategoryGroupId);
    }
  }
  return groups;
}

function paramValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function numberParam(value: string | string[] | undefined) {
  const text = textParam(value);
  if (!text || text.trim() === "") return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function viewportBoundsFromParams(params: Record<string, string | string[] | undefined>): SearchPlacesInput["viewportBounds"] | undefined {
  const minLat = numberParam(params.minLat);
  const minLng = numberParam(params.minLng);
  const maxLat = numberParam(params.maxLat);
  const maxLng = numberParam(params.maxLng);
  if (minLat === undefined || minLng === undefined || maxLat === undefined || maxLng === undefined) return undefined;
  return { minLat, minLng, maxLat, maxLng };
}
