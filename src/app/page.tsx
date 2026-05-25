import Link from "next/link";
import { cookies } from "next/headers";
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

import { applyAccountChildDefaults, childParamSourceForParams } from "@/app/account-child-defaults";
import { ExploreResults, type CategoryGroupSummary } from "@/app/explore-results";
import {
  CATEGORY_GROUP_CATEGORY_FILTERS,
  buildSearchInput,
  categoryGroupParams,
  resultLimitParam,
  sortParam,
  textParam,
  type CategoryGroupId
} from "@/app/home-search-state";
import { SearchFormLocationReset } from "@/app/search-form-location-reset";
import { SearchFilters } from "@/app/search-filters";
import { SearchResetButton } from "@/app/search-reset-button";
import { MAP_LOCATION_PARAM_KEYS, hasMapLocationParams } from "@/app/search-url-state";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import { shouldFallbackToAllCategoriesForQuery } from "@/lib/search-intent";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";
import { getMyProfile } from "@/lib/user-profile";

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
  const rawParams = await searchParams;
  const { childParamSource, homeLocation, params } = await paramsWithAccountDefaults(rawParams);
  let effectiveParams = params;
  let activeCategoryGroups = categoryGroupParams(params);
  let input = searchPlacesSchema.parse(buildSearchInput(params));
  let result = await safeSearch(input);

  if (result.meta.total === 0 && shouldFallbackToAllCategoriesForQuery(textParam(params.query), activeCategoryGroups)) {
    const fallbackParams = withoutCategoryParams(params);
    const fallbackInput = searchPlacesSchema.parse(buildSearchInput(fallbackParams));
    const fallbackResult = await safeSearch(fallbackInput);
    if (fallbackResult.meta.total > 0) {
      effectiveParams = fallbackParams;
      activeCategoryGroups = ["all"];
      input = fallbackInput;
      result = fallbackResult;
    }
  }

  const activeCategoryGroupLabel = categoryGroupSelectionLabel(activeCategoryGroups);
  const activeSort = sortParam(effectiveParams);
  const shouldAutoLocateWithHomeFallback = Boolean(homeLocation && !hasMapLocationParams(effectiveParams));

  return (
    <div className="page">
      <section className="search-shell">
        <form className="search-form" action="/">
          <CategoryGroupHiddenInputs activeCategoryGroups={activeCategoryGroups} />
          <input name="sort" type="hidden" value={activeSort} />
          <input name="limit" type="hidden" value={resultLimitParam(effectiveParams)} />
          <LocationStateInputs params={effectiveParams} />
          <SearchFormLocationReset />
          <div className="search-bar">
            <div className="search-query-capsule">
              <label className="query-field">
                <span className="sr-only">검색어</span>
                <input name="query" defaultValue={textParam(effectiveParams.query)} placeholder="물놀이, 비 오는 날, 수유실..." />
              </label>
              <button type="submit" className="primary-button" aria-label="검색">
                <Search size={18} aria-hidden="true" />
              </button>
            </div>
            <SearchResetButton />
          </div>

          <div className="category-tabs" aria-label="큰 분류 다중 선택">
            {Object.entries(CATEGORY_GROUPS).map(([groupId, group]) => {
              const Icon = group.icon;
              const isActive = categoryGroupIsActive(activeCategoryGroups, groupId as CategoryGroupId);

              return (
                <Link
                  className={`category-tab ${isActive ? "is-active" : ""}`}
                  href={categoryGroupHref(effectiveParams, groupId as CategoryGroupId, activeCategoryGroups)}
                  key={groupId}
                  aria-label={`${group.label}: ${group.hint} ${isActive ? "해제" : "추가"}`}
                  aria-pressed={isActive}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{group.label}</span>
                </Link>
              );
            })}
          </div>

          <SearchFilters childParamSource={childParamSource} initialParams={clientParams(effectiveParams)} />
        </form>
      </section>

      <ExploreResults
        activeCategoryGroup={activeCategoryGroups[0] ?? "all"}
        activeCategoryGroupLabel={activeCategoryGroupLabel}
        activeSort={activeSort}
        autoLocateOnInitialLoad={shouldAutoLocateWithHomeFallback}
        categoryGroups={clientCategoryGroups()}
        homeLocation={homeLocation}
        initialInput={input}
        initialParams={clientParams(effectiveParams)}
        initialResult={result}
      />
    </div>
  );
}

async function paramsWithAccountDefaults(params: Record<string, string | string[] | undefined>) {
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);
  if (!user) {
    return { childParamSource: childParamSourceForParams(params), homeLocation: null, params };
  }

  const profile = await getMyProfile(user.id);
  return { ...applyAccountChildDefaults(params, profile.children), homeLocation: profile.homeLocation };
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
  delete next.categoryGroups;
  delete next.offset;
  delete next.page;
  return next;
}

function categoryGroupHref(params: Record<string, string | string[] | undefined>, group: CategoryGroupId, activeGroups: CategoryGroupId[]): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "offset" || key === "category" || key === "categoryGroup" || key === "categoryGroups" || key === "visitContext") continue;
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

  const nextGroups = toggledCategoryGroups(activeGroups, group);
  if (nextGroups.length > 0) {
    query.categoryGroups = nextGroups.length === 1 ? nextGroups[0] : nextGroups;
  }

  return { pathname: "/", query };
}

function CategoryGroupHiddenInputs({ activeCategoryGroups }: { activeCategoryGroups: CategoryGroupId[] }) {
  const selected = activeCategoryGroups.filter((group) => group !== "all");
  if (selected.length === 0) return null;
  return (
    <>
      {selected.map((group) => (
        <input name="categoryGroups" type="hidden" value={group} key={group} />
      ))}
    </>
  );
}

function toggledCategoryGroups(activeGroups: CategoryGroupId[], group: CategoryGroupId) {
  if (group === "all") return [];
  const selected = activeGroups.filter((activeGroup) => activeGroup !== "all");
  if (selected.includes(group)) {
    return selected.filter((activeGroup) => activeGroup !== group);
  }
  return [...selected, group];
}

function categoryGroupIsActive(activeGroups: CategoryGroupId[], group: CategoryGroupId) {
  if (group === "all") return activeGroups.length === 0 || activeGroups.includes("all");
  return activeGroups.includes(group);
}

function categoryGroupSelectionLabel(activeGroups: CategoryGroupId[]) {
  const selected = activeGroups.filter((group) => group !== "all");
  if (selected.length === 0) return CATEGORY_GROUPS.all.label;
  return selected.map((group) => CATEGORY_GROUPS[group].label).join(", ");
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
