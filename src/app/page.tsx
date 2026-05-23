import Link from "next/link";
import type { UrlObject } from "url";
import {
  Baby,
  BedDouble,
  Blocks,
  Building2,
  Puzzle,
  Search,
  ShoppingBag,
  TreePine,
  Utensils,
  type LucideIcon
} from "lucide-react";

import { ExploreResults, type CategoryGroupSummary } from "@/app/explore-results";
import { SearchFilters } from "@/app/search-filters";
import { parseChildAgeMonths } from "@/lib/child-ages";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import { shouldFallbackToAllCategoriesForQuery } from "@/lib/search-intent";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.3322,
  lng: 127.4341,
  label: "기본 지도 중심"
};
const DEFAULT_RESULT_LIMIT = 30;
const RESULT_LIMIT_OPTIONS = [30, 50, 100] as const;
const CATEGORY_GROUPS = {
  all: { label: "전체", hint: "모두", icon: Blocks, categories: undefined },
  stay: { label: "숙박", hint: "키즈 숙소", icon: BedDouble, categories: ["accommodation"] },
  visit: {
    label: "방문",
    hint: "과학관/문화",
    icon: Building2,
    categories: ["science_museum", "museum", "experience_center", "aquarium_zoo", "library", "toy_library", "sports_venue", "rest_area"]
  },
  shopping: { label: "쇼핑몰", hint: "백화점/몰", icon: ShoppingBag, categories: ["shopping_mall"] },
  toyStore: { label: "장난감", hint: "완구 매장", icon: Puzzle, categories: ["toy_store"] },
  playground: { label: "놀이터", hint: "공공놀이", icon: TreePine, categories: ["park", "indoor_playground"] },
  kidsCafe: { label: "키즈카페", hint: "상업놀이", icon: Baby, categories: ["kids_cafe", "family_cafe"] },
  playroomDining: { label: "놀이방 식당", hint: "식사+놀이", icon: Utensils, categories: ["family_restaurant"] }
} as const satisfies Record<
  string,
  {
    categories?: readonly string[];
    hint: string;
    icon: LucideIcon;
    label: string;
  }
>;
type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryGroupId = keyof typeof CATEGORY_GROUPS;

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  let effectiveParams = params;
  let activeCategoryGroup = categoryGroupParam(params);
  let input = searchPlacesSchema.parse(buildSearchInput(params));
  let result = await safeSearch(input);

  if (result.meta.total === 0 && shouldFallbackToAllCategoriesForQuery(textParam(params.query), activeCategoryGroup)) {
    const fallbackParams = withoutCategoryParams(params);
    const fallbackInput = searchPlacesSchema.parse(buildSearchInput(fallbackParams));
    const fallbackResult = await safeSearch(fallbackInput);
    if (fallbackResult.meta.total > 0) {
      effectiveParams = fallbackParams;
      activeCategoryGroup = "all";
      input = fallbackInput;
      result = fallbackResult;
    }
  }

  const activeCategoryGroupConfig = CATEGORY_GROUPS[activeCategoryGroup];
  const activeSort = sortParam(effectiveParams);

  return (
    <div className="page">
      <section className="search-shell">
        <form className="search-form" action="/">
          <input name="categoryGroup" type="hidden" value={activeCategoryGroup} />
          <input name="sort" type="hidden" value={activeSort} />
          <input name="limit" type="hidden" value={resultLimitParam(effectiveParams)} />
          <ViewportBoundsInputs params={effectiveParams} />
          <div className="search-bar">
            <label className="query-field">
              <span className="sr-only">검색어</span>
              <input name="query" defaultValue={textParam(effectiveParams.query)} placeholder="물놀이, 비 오는 날, 수유실..." />
            </label>
            <button type="submit" className="primary-button">
              <Search size={17} aria-hidden="true" />
              검색
            </button>
          </div>

          <div className="category-tabs" aria-label="큰 분류">
            {Object.entries(CATEGORY_GROUPS).map(([groupId, group]) => {
              const Icon = group.icon;

              return (
                <Link
                  className={`category-tab ${activeCategoryGroup === groupId ? "is-active" : ""}`}
                  href={categoryGroupHref(effectiveParams, groupId as CategoryGroupId)}
                  key={groupId}
                  aria-label={`${group.label}: ${group.hint}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{group.label}</span>
                </Link>
              );
            })}
          </div>

          <SearchFilters initialParams={clientParams(effectiveParams)} />
        </form>
      </section>

      <ExploreResults
        activeCategoryGroup={activeCategoryGroup}
        activeCategoryGroupLabel={activeCategoryGroupConfig.label}
        activeSort={activeSort}
        categoryGroups={clientCategoryGroups()}
        initialInput={input}
        initialParams={clientParams(effectiveParams)}
        initialResult={result}
      />
    </div>
  );
}

function ViewportBoundsInputs({ params }: { params: Record<string, string | string[] | undefined> }) {
  const viewportBounds = viewportBoundsFromParams(params);
  if (!viewportBounds) return null;

  return (
    <>
      <input name="minLat" type="hidden" value={viewportBounds.minLat} />
      <input name="minLng" type="hidden" value={viewportBounds.minLng} />
      <input name="maxLat" type="hidden" value={viewportBounds.maxLat} />
      <input name="maxLng" type="hidden" value={viewportBounds.maxLng} />
    </>
  );
}

function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const category = textParam(params.category);
  const categoryGroup = categoryGroupParam(params);
  const groupCategories = CATEGORY_GROUPS[categoryGroup].categories;
  const limit = resultLimitParam(params);
  const page = currentPageParam(params);
  const nearby = textParam(params.nearby) === "1";
  const viewportBounds = viewportBoundsFromParams(params);
  const shouldFilterByRadius = categoryGroup !== "stay" || hasExplicitLocationParams(params);
  const lat = Number(textParam(params.lat) || DEFAULT_ORIGIN.lat);
  const lng = Number(textParam(params.lng) || DEFAULT_ORIGIN.lng);
  const ages = parseChildAgeMonths(textParam(params.ages));

  return {
    origin: { lat, lng, label: nearby ? "현재 위치" : viewportBounds ? "지도 중심" : DEFAULT_ORIGIN.label },
    visitContext: (textParam(params.visitContext) || undefined) as SearchPlacesInput["visitContext"],
    radiusKm: shouldFilterByRadius ? Number(textParam(params.radiusKm) || 80) : undefined,
    filterByRadius: viewportBounds ? false : shouldFilterByRadius,
    viewportBounds,
    query: textParam(params.query) || undefined,
    primaryCategories: groupCategories ? [...groupCategories] : category ? [category] : undefined,
    playgroundOnly: categoryGroup === "playground" ? true : undefined,
    kidsCafeOnly: categoryGroup === "kidsCafe" ? true : undefined,
    childAgeMonths: ages,
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

function hasExplicitLocationParams(params: Record<string, string | string[] | undefined>) {
  return Boolean(textParam(params.nearby) === "1" || textParam(params.lat) || textParam(params.lng) || textParam(params.radiusKm) || viewportBoundsFromParams(params));
}

async function safeSearch(input: SearchPlacesInput) {
  try {
    return { ...(await searchPlaces(input)), error: undefined as string | undefined };
  } catch (error) {
    return {
      items: [],
      meta: {
        count: 0,
        total: 0,
        limit: input.limit,
        offset: input.offset,
        projection: input.projection ?? "full",
        origin: input.origin ?? null,
        coursePlan: null,
        search: {
          originalQuery: input.query ?? null,
          normalizedQuery: input.query ?? null,
          appliedPreferences: input.preferences ?? null,
          preferenceSemantics: buildSearchPreferenceSemantics(input.preferences),
          visitContext: input.visitContext ?? null,
          normalized: false
        }
      },
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다."
    };
  }
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function withoutCategoryParams(params: Record<string, string | string[] | undefined>) {
  const next = { ...params };
  delete next.category;
  delete next.categoryGroup;
  delete next.offset;
  delete next.page;
  return next;
}

function resultLimitParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.limit) || DEFAULT_RESULT_LIMIT);
  return RESULT_LIMIT_OPTIONS.find((option) => option === requested) ?? DEFAULT_RESULT_LIMIT;
}

function currentPageParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.page) || 1);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

function sortParam(params: Record<string, string | string[] | undefined>): Extract<SearchPlacesInput["sort"], "recommended" | "distance"> {
  const value = textParam(params.sort);
  if (value === "recommended" || value === "distance") {
    return value;
  }
  return textParam(params.nearby) === "1" ? "distance" : "recommended";
}

function categoryGroupParam(params: Record<string, string | string[] | undefined>): CategoryGroupId {
  const value = textParam(params.categoryGroup);
  return value && value in CATEGORY_GROUPS ? (value as CategoryGroupId) : "all";
}

function categoryGroupHref(params: Record<string, string | string[] | undefined>, group: CategoryGroupId): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "offset" || key === "category" || key === "categoryGroup" || key === "visitContext") continue;
    if (Array.isArray(value)) {
      const values = value.filter(Boolean);
      if (values.length === 1) {
        query[key] = values[0];
      } else if (values.length > 1) {
        query[key] = values;
      }
      continue;
    }
    if (value) query[key] = value;
  }

  if (group !== "all") {
    query.categoryGroup = group;
  }

  return { pathname: "/", query };
}

function clientParams(params: Record<string, string | string[] | undefined>) {
  const next: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const values = value.filter(Boolean);
      if (values.length === 1) next[key] = values[0];
      if (values.length > 1) next[key] = values;
      continue;
    }
    if (value) next[key] = value;
  }
  return next;
}

function clientCategoryGroups(): Record<string, CategoryGroupSummary> {
  return Object.fromEntries(Object.entries(CATEGORY_GROUPS).map(([id, group]) => [id, { iconName: group.icon.displayName ?? id, label: group.label }]));
}
