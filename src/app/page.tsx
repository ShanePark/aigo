import Link from "next/link";
import type { UrlObject } from "url";
import {
  ArrowUpDown,
  Baby,
  BedDouble,
  Blocks,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  MapPin,
  Puzzle,
  RotateCcw,
  Search,
  SearchX,
  ShoppingBag,
  SlidersHorizontal,
  TreePine,
  Utensils,
  type LucideIcon
} from "lucide-react";

import { PlaceImage } from "@/app/place-image";
import { PlacesMap, type MapOrigin, type MapPlace } from "@/app/places-map";
import { SearchResultTrustBadges } from "@/app/search-result-badges";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import { pricingSummaryLabel } from "@/lib/pricing";
import { shouldFallbackToAllCategoriesForQuery } from "@/lib/search-intent";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.3322,
  lng: 127.4341,
  label: "대전역/원도심"
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
const TAG_LABELS: Record<string, string> = {
  babyChair: "아기의자",
  childrenRoom: "어린이자료실",
  diaperChangingTable: "기저귀",
  familyRestaurant: "가족식당",
  infantRoom: "유아실",
  kidsCafe: "키즈카페",
  library: "도서관",
  meatRestaurant: "고깃집",
  nursingRoom: "수유실",
  parking: "주차",
  playroom: "놀이방",
  publicFacility: "공공시설",
  publicLibrary: "공공도서관",
  sandPlay: "모래놀이",
  science: "과학",
  shoppingMall: "쇼핑몰",
  slide: "미끄럼틀",
  swing: "그네",
  seesaw: "시소",
  stroller: "유모차",
  toyLibrary: "장난감도서관",
  toyStore: "장난감가게",
  waterPlayground: "물놀이터"
};

const RESULT_CARD_PLAY_FEATURE_LABELS: Record<string, string> = {
  slide: "미끄럼틀",
  swing: "그네",
  seesaw: "시소",
  babySwing: "영아그네",
  sandPlay: "모래놀이",
  waterPlayground: "물놀이터",
  climbing: "클라이밍",
  trampoline: "트램폴린",
  rideOnToys: "승용완구",
  playHouse: "놀이집"
};
const RELAXED_SEARCH_PARAM_KEYS = new Set(["babyChair", "indoor", "maxLat", "maxLng", "minLat", "minLng", "nursing", "offset", "page", "parking", "stroller"]);

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

  const nationwideStaySearch = isNationwideStaySearch(activeCategoryGroup, effectiveParams);
  const activeCategoryGroupConfig = CATEGORY_GROUPS[activeCategoryGroup];
  const activeSort = sortParam(effectiveParams);
  const mapOrigin = mapOriginFromMeta(result.meta);
  const searchReturnHref = currentSearchHref(effectiveParams);
  const mapPlaces = result.items.map((place) => mapPlaceForMap(place, searchReturnHref));

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
              <span>검색어</span>
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

          <details className="advanced-search">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              세부 조건
            </summary>
            <div className="advanced-checks" aria-label="선호 조건">
              <label className="check">
                <input name="indoor" type="checkbox" defaultChecked={effectiveParams.indoor === "on"} />
                <span>실내</span>
              </label>
              <label className="check">
                <input name="parking" type="checkbox" defaultChecked={effectiveParams.parking === "on"} />
                <span>주차</span>
              </label>
              <label className="check">
                <input name="stroller" type="checkbox" defaultChecked={effectiveParams.stroller === "on"} />
                <span>유모차</span>
              </label>
              <label className="check">
                <input name="nursing" type="checkbox" defaultChecked={effectiveParams.nursing === "on"} />
                <span>수유실</span>
              </label>
              <label className="check">
                <input name="babyChair" type="checkbox" defaultChecked={effectiveParams.babyChair === "on"} />
                <span>아기의자</span>
              </label>
            </div>
            <div className="advanced-grid">
              <label>
                <span>아이 월령</span>
                <input name="ages" defaultValue={textParam(effectiveParams.ages) || "32,7,7"} placeholder="32,7,7" />
              </label>
              <label>
                <span>위도</span>
                <input name="lat" type="number" step="0.000001" defaultValue={textParam(effectiveParams.lat) ?? (nationwideStaySearch ? "" : String(DEFAULT_ORIGIN.lat))} />
              </label>
              <label>
                <span>경도</span>
                <input name="lng" type="number" step="0.000001" defaultValue={textParam(effectiveParams.lng) ?? (nationwideStaySearch ? "" : String(DEFAULT_ORIGIN.lng))} />
              </label>
            </div>
          </details>
        </form>
      </section>

      {result.error ? (
        <SearchErrorState message={result.error} params={effectiveParams} />
      ) : (
        <section className="explore-layout">
          <PlacesMap origin={mapOrigin} places={mapPlaces} searchHref={searchReturnHref} />
          <div className="results-panel">
            <section className="result-header">
              <div>
                <h2>{activeCategoryGroup === "all" ? "주변 장소" : activeCategoryGroupConfig.label}</h2>
                <p>{resultCountLabel(result.meta)}</p>
              </div>
              <div className="result-actions">
                <SortControls activeSort={activeSort} params={effectiveParams} />
                <LimitControls activeLimit={resultLimitParam(effectiveParams)} params={effectiveParams} />
                {result.meta.total > 0 ? <span className="page-badge">{currentResultPage(result.meta)}페이지</span> : null}
              </div>
            </section>

            <div className="results-scroll" data-results-scroll>
              <div className="results">
                {result.items.map((place, index) => (
                  <ResultCard index={result.meta.offset + index + 1} place={place} returnHref={searchReturnHref} key={place.placeId} />
                ))}
                {result.items.length === 0 ? <SearchEmptyState activeCategoryGroup={activeCategoryGroup} params={effectiveParams} /> : null}
              </div>
            </div>
            <Pagination meta={result.meta} params={effectiveParams} />
          </div>
        </section>
      )}
    </div>
  );
}

function SearchErrorState({ message, params }: { message: string; params: Record<string, string | string[] | undefined> }) {
  return (
    <section className="empty-state empty-state-page empty-state-error" aria-live="polite">
      <div className="empty-state-icon">
        <CircleAlert size={24} aria-hidden="true" />
      </div>
      <div className="empty-state-copy">
        <p className="empty-state-kicker">검색 오류</p>
        <h2>장소를 불러오지 못했습니다</h2>
        <p>{message}</p>
      </div>
      <div className="empty-state-actions">
        <Link className="empty-state-action is-primary" href={currentSearchUrlObject(params)}>
          <RotateCcw size={15} aria-hidden="true" />
          다시 시도
        </Link>
        {hasRelaxableParams(params) ? (
          <Link className="empty-state-action" href={relaxedSearchHref(params)}>
            <SearchX size={15} aria-hidden="true" />
            조건 줄이기
          </Link>
        ) : null}
        <Link className="empty-state-action" href="/">
          <Blocks size={15} aria-hidden="true" />
          전체 보기
        </Link>
      </div>
    </section>
  );
}

function SearchEmptyState({ activeCategoryGroup, params }: { activeCategoryGroup: CategoryGroupId; params: Record<string, string | string[] | undefined> }) {
  const suggestedGroups = emptyStateCategoryGroups(activeCategoryGroup);

  return (
    <section className="empty-state" aria-live="polite">
      <div className="empty-state-icon">
        <SearchX size={24} aria-hidden="true" />
      </div>
      <div className="empty-state-copy">
        <p className="empty-state-kicker">결과 없음</p>
        <h3>조건에 맞는 장소가 아직 없습니다</h3>
        <p>실내, 주차, 유모차 같은 조건을 조금 줄이거나 다른 큰 분류에서 다시 찾아볼 수 있습니다.</p>
      </div>
      <div className="empty-state-actions">
        {hasRelaxableParams(params) ? (
          <Link className="empty-state-action is-primary" href={relaxedSearchHref(params)}>
            <SearchX size={15} aria-hidden="true" />
            조건 줄이기
          </Link>
        ) : null}
        <Link className={`empty-state-action ${hasRelaxableParams(params) ? "" : "is-primary"}`} href="/">
          <Blocks size={15} aria-hidden="true" />
          전체 보기
        </Link>
        {suggestedGroups.map((groupId) => {
          const group = CATEGORY_GROUPS[groupId];
          const Icon = group.icon;

          return (
            <Link className="empty-state-action" href={categoryGroupHref(params, groupId)} key={groupId}>
              <Icon size={15} aria-hidden="true" />
              {group.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ResultCard({ index, place, returnHref }: { index: number; place: SearchItem; returnHref: string }) {
  const keywords = resultKeywordChips(place);
  const primaryImage = place.primaryImage;
  const priceLabel = pricingSummaryLabel(place.pricing);
  const category = categoryLabel(place.primaryCategory);

  return (
    <Link
      className="result-card"
      data-map-place-card="true"
      data-map-place-id={place.placeId}
      data-map-place-lat={place.lat}
      data-map-place-lng={place.lng}
      id={`place-card-${place.placeId}`}
      href={placeDetailHref(place.placeId, returnHref)}
    >
      <PlaceImage category={place.primaryCategory} src={primaryImage?.url} alt={`${place.name} 대표 이미지`} variant="result" />
      <div className="result-card-body">
        <div className="result-card-topline">
          <span className="rank-badge">{index}</span>
          <span className="category-pill">{category}</span>
          <span className="distance-pill">
            <MapPin size={14} aria-hidden="true" />
            {distanceLabel(place.distanceKm)}
          </span>
        </div>
        <div className="result-card-title-row">
          <h3>{place.name}</h3>
          <span className={`score-pill ${scoreTone(place.score)}`}>추천 {place.score}</span>
        </div>
        <div className="keyword-row" aria-label="키워드">
          {keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
        {priceLabel ? (
          <div className="trust-row">
            <span className="trust-badge warning">{priceLabel}</span>
          </div>
        ) : null}
        <SearchResultTrustBadges openingHoursSummary={place.openingHoursSummary} sourceSummary={place.sourceSummary} />
      </div>
    </Link>
  );
}

function SortControls({
  activeSort,
  params
}: {
  activeSort: Extract<SearchPlacesInput["sort"], "recommended" | "distance">;
  params: Record<string, string | string[] | undefined>;
}) {
  return (
    <nav className="sort-control" aria-label="목록 정렬">
      <span>
        <ArrowUpDown size={13} aria-hidden="true" />
        정렬
      </span>
      <Link className={`sort-option ${activeSort === "recommended" ? "is-active" : ""}`} href={sortHref(params, "recommended")}>
        관련도순
      </Link>
      <Link className={`sort-option ${activeSort === "distance" ? "is-active" : ""}`} href={sortHref(params, "distance")}>
        거리순
      </Link>
    </nav>
  );
}

function LimitControls({ activeLimit, params }: { activeLimit: (typeof RESULT_LIMIT_OPTIONS)[number]; params: Record<string, string | string[] | undefined> }) {
  return (
    <nav className="limit-control" aria-label="한 페이지 표시 개수">
      <span>표시</span>
      {RESULT_LIMIT_OPTIONS.map((limit) => (
        <Link className={`limit-option ${activeLimit === limit ? "is-active" : ""}`} href={limitHref(params, limit)} key={limit}>
          {limit}개
        </Link>
      ))}
    </nav>
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
  const ages = (textParam(params.ages) || "32,7,7")
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isFinite(age));

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

function isNationwideStaySearch(categoryGroup: CategoryGroupId, params: Record<string, string | string[] | undefined>) {
  return categoryGroup === "stay" && !hasExplicitLocationParams(params);
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

function hasRelaxableParams(params: Record<string, string | string[] | undefined>) {
  return Array.from(RELAXED_SEARCH_PARAM_KEYS).some((key) => Boolean(textParam(params[key])));
}

function relaxedSearchHref(params: Record<string, string | string[] | undefined>): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (RELAXED_SEARCH_PARAM_KEYS.has(key) || key === "visitContext") continue;
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

  return { pathname: "/", query };
}

function emptyStateCategoryGroups(activeCategoryGroup: CategoryGroupId) {
  const suggestions: CategoryGroupId[] = ["kidsCafe", "playground", "shopping", "visit"];
  return suggestions.filter((groupId) => groupId !== activeCategoryGroup);
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

type SearchItem = Awaited<ReturnType<typeof searchPlaces>>["items"][number];
type SearchResultMeta = Awaited<ReturnType<typeof searchPlaces>>["meta"];

function categoryGroupParam(params: Record<string, string | string[] | undefined>): CategoryGroupId {
  const value = textParam(params.categoryGroup);
  return value && value in CATEGORY_GROUPS ? (value as CategoryGroupId) : "all";
}

function resultCountLabel(meta: SearchResultMeta) {
  if (meta.total === 0 || meta.count === 0) {
    return `${meta.total}개 후보`;
  }

  const start = Math.min(meta.offset + 1, meta.total);
  const end = Math.min(meta.offset + meta.count, meta.total);
  return `${meta.total}개 중 ${start}-${end}번째`;
}

function currentResultPage(meta: SearchResultMeta) {
  return Math.floor(meta.offset / meta.limit) + 1;
}

function Pagination({ meta, params }: { meta: SearchResultMeta; params: Record<string, string | string[] | undefined> }) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const currentPage = Math.min(currentResultPage(meta), totalPages);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="검색 결과 페이지">
      {currentPage > 1 ? (
        <Link className="page-control" href={pageHref(params, currentPage - 1, meta.limit)}>
          <ChevronLeft size={16} aria-hidden="true" />
          이전
        </Link>
      ) : (
        <span className="page-control is-disabled">
          <ChevronLeft size={16} aria-hidden="true" />
          이전
        </span>
      )}

      <div className="page-numbers">
        {pageItems(currentPage, totalPages).map((page, index) =>
          page === "gap" ? (
            <span className="page-ellipsis" key={`gap-${index}`}>
              ...
            </span>
          ) : page === currentPage ? (
            <span className="page-number is-current" aria-current="page" key={page}>
              {page}
            </span>
          ) : (
            <Link className="page-number" href={pageHref(params, page, meta.limit)} key={page}>
              {page}
            </Link>
          )
        )}
      </div>

      {currentPage < totalPages ? (
        <Link className="page-control" href={pageHref(params, currentPage + 1, meta.limit)}>
          다음
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span className="page-control is-disabled">
          다음
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

function pageItems(currentPage: number, totalPages: number) {
  const candidates = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pages = Array.from(candidates)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];

  for (const page of pages) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      items.push("gap");
    }
    items.push(page);
  }

  return items;
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number, limit: number): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "offset" || key === "visitContext") continue;
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

  query.limit = String(limit);
  if (page > 1) {
    query.page = String(page);
  }

  return { pathname: "/", query };
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

function sortHref(params: Record<string, string | string[] | undefined>, sort: Extract<SearchPlacesInput["sort"], "recommended" | "distance">): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "offset" || key === "sort" || key === "visitContext") continue;
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

  query.sort = sort;
  return { pathname: "/", query };
}

function limitHref(params: Record<string, string | string[] | undefined>, limit: (typeof RESULT_LIMIT_OPTIONS)[number]): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "offset" || key === "limit" || key === "visitContext") continue;
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

  query.limit = String(limit);
  return { pathname: "/", query };
}

function currentSearchHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "offset" || key === "returnTo" || key === "visitContext") continue;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, item));
      continue;
    }
    if (value) query.set(key, value);
  }

  const search = query.toString();
  return search ? `/?${search}` : "/";
}

function currentSearchUrlObject(params: Record<string, string | string[] | undefined>): UrlObject {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "offset" || key === "returnTo" || key === "visitContext") continue;
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

  return { pathname: "/", query };
}

function placeDetailHref(placeId: string, returnHref: string): UrlObject {
  return {
    pathname: `/places/${placeId}`,
    query: { returnTo: returnHref }
  };
}

function placeDetailPath(placeId: string, returnHref: string) {
  const query = new URLSearchParams({ returnTo: returnHref });
  return `/places/${placeId}?${query.toString()}`;
}

function mapOriginFromMeta(meta: SearchResultMeta): MapOrigin {
  if (!meta.origin) return null;
  return {
    label: meta.origin.label ?? DEFAULT_ORIGIN.label,
    lat: meta.origin.lat,
    lng: meta.origin.lng
  };
}

function mapPlaceForMap(place: SearchItem, returnHref: string): MapPlace {
  return {
    category: place.primaryCategory,
    distance: distanceLabel(place.distanceKm),
    href: placeDetailPath(place.placeId, returnHref),
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    placeId: place.placeId
  };
}

function resultKeywordChips(place: SearchItem) {
  const keywords = [
    indoorLabel(place.facilities.indoorType),
    ...positivePlayFeatureKeywords(place),
    ...place.tags.map(formatKeyword),
    ...positiveFacilityKeywords(place)
  ];

  return Array.from(new Set(keywords.filter(Boolean))).slice(0, 5);
}

function positivePlayFeatureKeywords(place: SearchItem) {
  return Object.entries(RESULT_CARD_PLAY_FEATURE_LABELS)
    .filter(([key]) => positivePlayFeatureValue(place.playFeatures?.[key]))
    .map(([, label]) => label);
}

function positivePlayFeatureValue(value: unknown) {
  return value === "yes" || value === "partial" || value === true;
}

function positiveFacilityKeywords(place: SearchItem) {
  const facilities = [
    [place.facilities.parkingAvailable, "주차"],
    [place.facilities.strollerFriendly, "유모차"],
    [place.facilities.nursingRoom, "수유실"],
    [place.facilities.diaperChangingTable, "기저귀"],
    [place.facilities.babyChair, "아기의자"]
  ];

  return facilities.filter(([value]) => value === "yes").map(([, label]) => String(label));
}

function scoreTone(score: number) {
  if (score >= 65) return "score-high";
  if (score >= 58) return "score-good";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function formatKeyword(value: string) {
  if (TAG_LABELS[value]) return TAG_LABELS[value];
  if (/[가-힣]/.test(value)) return value.replace(/[_-]+/g, " ");
  return "";
}

function distanceLabel(value: number | null) {
  return value === null ? "거리 미계산" : `${value.toFixed(1)}km`;
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    kids_cafe: "키즈카페",
    indoor_playground: "실내놀이터",
    toy_store: "장난감 가게",
    toy_library: "장난감도서관",
    library: "도서관",
    museum: "박물관/미술관",
    science_museum: "과학관",
    experience_center: "체험관",
    aquarium_zoo: "동물/아쿠아리움",
    park: "공원/놀이터",
    family_cafe: "가족 카페",
    family_restaurant: "놀이방/가족 식당",
    sports_venue: "스포츠/야구장",
    shopping_mall: "쇼핑/몰",
    rest_area: "휴게소/쉼터",
    accommodation: "키즈 숙소"
  };
  return labels[value] ?? value;
}

function indoorLabel(value: string) {
  const labels: Record<string, string> = {
    indoor: "실내",
    outdoor: "실외",
    mixed: "실내외",
    unknown: "확인중"
  };
  return labels[value] ?? value;
}
