import { childProfilesToAgeMonths, parseChildAgeMonths, parseChildProfiles } from "@/lib/child-ages";
import type { SearchPlacesInput } from "@/lib/schemas";

export const DEFAULT_ORIGIN = {
  lat: 36.5,
  lng: 127.8,
  label: "전국 지도 중심"
};
export const DEFAULT_RESULT_LIMIT = 30;
export const RESULT_LIMIT_OPTIONS = [30, 50, 100] as const;
export const CATEGORY_GROUP_CATEGORY_FILTERS = {
  all: undefined,
  stay: ["accommodation"],
  visit: ["science_museum", "museum", "experience_center", "aquarium_zoo", "library", "toy_library", "sports_venue", "rest_area"],
  shopping: ["shopping_mall"],
  toyStore: ["toy_store"],
  playground: ["park", "indoor_playground"],
  kidsCafe: ["kids_cafe", "family_cafe"],
  playroomDining: ["family_restaurant"]
} as const satisfies Record<string, readonly string[] | undefined>;

export type CategoryGroupId = keyof typeof CATEGORY_GROUP_CATEGORY_FILTERS;

export function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const category = textParam(params.category);
  const categoryGroup = categoryGroupParam(params);
  const groupCategories = CATEGORY_GROUP_CATEGORY_FILTERS[categoryGroup];
  const limit = resultLimitParam(params);
  const page = currentPageParam(params);
  const nearby = textParam(params.nearby) === "1";
  const query = textParam(params.query)?.trim();
  const viewportBounds = viewportBoundsFromParams(params);
  const shouldFilterByRadius = viewportBounds ? false : shouldApplyRadiusFilter(params, categoryGroup, Boolean(query));
  const radiusKm = Number(textParam(params.radiusKm) || defaultRadiusKmForCategoryGroup(categoryGroup));
  const lat = Number(textParam(params.lat) || DEFAULT_ORIGIN.lat);
  const lng = Number(textParam(params.lng) || DEFAULT_ORIGIN.lng);
  const children = textParam(params.children);
  const ages = children
    ? childProfilesToAgeMonths(parseChildProfiles(children, textParam(params.ages)))
    : parseChildAgeMonths(textParam(params.ages));

  return {
    origin: { lat, lng, label: nearby ? "현재 위치" : viewportBounds ? "지도 중심" : DEFAULT_ORIGIN.label },
    visitContext: (textParam(params.visitContext) || undefined) as SearchPlacesInput["visitContext"],
    radiusKm: shouldFilterByRadius ? radiusKm : undefined,
    filterByRadius: shouldFilterByRadius,
    viewportBounds,
    query: query || undefined,
    primaryCategories: groupCategories ? [...groupCategories] : category ? [category] : undefined,
    playgroundOnly: categoryGroup === "playground" ? true : undefined,
    kidsCafeOnly: categoryGroup === "kidsCafe" ? true : undefined,
    childAgeMonths: ages,
    preferenceMode: preferenceModeParam(params),
    preferences: {
      indoorTypes: params.indoor === "on" ? ["indoor", "mixed"] : undefined,
      parkingAvailable: params.parking === "on" ? true : undefined,
      strollerFriendly: params.stroller === "on" ? true : undefined,
      nursingRoom: params.nursing === "on" ? true : undefined,
      babyChair: params.babyChair === "on" ? true : undefined
    },
    sort: sortParam(params),
    limit,
    offset: Math.min((page - 1) * limit, 1000)
  };
}

export function resultLimitParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.limit) || DEFAULT_RESULT_LIMIT);
  return RESULT_LIMIT_OPTIONS.find((option) => option === requested) ?? DEFAULT_RESULT_LIMIT;
}

export function sortParam(params: Record<string, string | string[] | undefined>): Extract<SearchPlacesInput["sort"], "recommended" | "distance"> {
  const value = textParam(params.sort);
  if (value === "recommended" || value === "distance") {
    return value;
  }
  return textParam(params.nearby) === "1" ? "distance" : "recommended";
}

export function preferenceModeParam(params: Record<string, string | string[] | undefined>): SearchPlacesInput["preferenceMode"] {
  const value = textParam(params.preferenceMode);
  return value === "required" ? "required" : undefined;
}

export function categoryGroupParam(params: Record<string, string | string[] | undefined>): CategoryGroupId {
  const value = textParam(params.categoryGroup);
  return value && value in CATEGORY_GROUP_CATEGORY_FILTERS ? (value as CategoryGroupId) : "all";
}

export function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentPageParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.page) || 1);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

function hasExplicitLocationParams(params: Record<string, string | string[] | undefined>) {
  return Boolean(textParam(params.nearby) === "1" || textParam(params.lat) || textParam(params.lng) || textParam(params.radiusKm) || viewportBoundsFromParams(params));
}

function shouldApplyRadiusFilter(params: Record<string, string | string[] | undefined>, categoryGroup: CategoryGroupId, hasQuery: boolean) {
  if (!hasQuery) return hasExplicitLocationParams(params);
  return textParam(params.nearby) === "1" || Boolean(textParam(params.radiusKm));
}

function defaultRadiusKmForCategoryGroup(categoryGroup: CategoryGroupId) {
  switch (categoryGroup) {
    case "playground":
      return 20;
    case "visit":
      return 220;
    case "stay":
      return 300;
    default:
      return 80;
  }
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
