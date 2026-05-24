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
import {
  CATEGORY_GROUP_CATEGORY_FILTERS,
  buildSearchInput,
  categoryGroupParam,
  resultLimitParam,
  sortParam,
  textParam,
  type CategoryGroupId
} from "@/app/home-search-state";
import { SearchFormLocationReset } from "@/app/search-form-location-reset";
import { SearchFilters } from "@/app/search-filters";
import { MAP_LOCATION_PARAM_KEYS } from "@/app/search-url-state";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import { shouldFallbackToAllCategoriesForQuery } from "@/lib/search-intent";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const CATEGORY_GROUPS = {
  all: { label: "전체", hint: "모두", icon: Blocks, categories: CATEGORY_GROUP_CATEGORY_FILTERS.all },
  stay: { label: "숙박", hint: "키즈 숙소", icon: BedDouble, categories: CATEGORY_GROUP_CATEGORY_FILTERS.stay },
  visit: {
    label: "방문",
    hint: "과학관/문화",
    icon: Building2,
    categories: CATEGORY_GROUP_CATEGORY_FILTERS.visit
  },
  shopping: { label: "쇼핑몰", hint: "백화점/몰", icon: ShoppingBag, categories: CATEGORY_GROUP_CATEGORY_FILTERS.shopping },
  toyStore: { label: "장난감", hint: "완구 매장", icon: Puzzle, categories: CATEGORY_GROUP_CATEGORY_FILTERS.toyStore },
  playground: { label: "놀이터", hint: "공공놀이", icon: TreePine, categories: CATEGORY_GROUP_CATEGORY_FILTERS.playground },
  kidsCafe: { label: "키즈카페", hint: "상업놀이", icon: Baby, categories: CATEGORY_GROUP_CATEGORY_FILTERS.kidsCafe },
  playroomDining: { label: "놀이방 식당", hint: "식사+놀이", icon: Utensils, categories: CATEGORY_GROUP_CATEGORY_FILTERS.playroomDining }
} as const satisfies Record<
  CategoryGroupId,
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
          <LocationStateInputs params={effectiveParams} />
          <SearchFormLocationReset />
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

function LocationStateInputs({ params }: { params: Record<string, string | string[] | undefined> }) {
  const locationParams = locationStateParams(params);
  if (locationParams.length === 0) return null;

  return (
    <>
      {locationParams.map(([key, value]) => (
        <input name={key} type="hidden" value={value} key={key} />
      ))}
    </>
  );
}

function locationStateParams(params: Record<string, string | string[] | undefined>) {
  return MAP_LOCATION_PARAM_KEYS.flatMap((key) => {
    const value = textParam(params[key]);
    return value ? ([[key, value]] as const) : [];
  });
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
          locationQuery: null,
          temporalTerms: [],
          suggestedExactNameQuery: null,
          appliedPreferences: input.preferences ?? null,
          preferenceSemantics: buildSearchPreferenceSemantics(input.preferences, input.preferenceMode),
          visitContext: input.visitContext ?? null,
          normalized: false
        }
      },
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다."
    };
  }
}

function withoutCategoryParams(params: Record<string, string | string[] | undefined>) {
  const next = { ...params };
  delete next.category;
  delete next.categoryGroup;
  delete next.offset;
  delete next.page;
  return next;
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
