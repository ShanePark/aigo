"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UrlObject } from "url";
import { Blocks, ChevronLeft, ChevronRight, CircleAlert, MapPin, RotateCcw, SearchX, Star } from "lucide-react";

import { PlaceImage } from "@/app/place-image";
import { PlacesMap, type MapOrigin, type MapPlace, type ViewportSearchRequest } from "@/app/places-map";
import { buildSearchInput } from "@/app/home-search-state";
import {
  CLIENT_SEARCH_EVENT,
  MAP_LOCATION_PARAM_KEYS,
  searchParamsForCurrentLocation,
  searchParamsForViewportSearch,
  type ClientSearchEventDetail,
  type SearchParamsRecord
} from "@/app/search-url-state";
import {
  SearchResultTrustBadges,
  type SearchResultBadgeOpeningHoursSummary,
  type SearchResultBadgeRecommendationReadiness,
  type SearchResultBadgeSourceSummary
} from "@/app/search-result-badges";
import { pricingSummaryLabel } from "@/lib/pricing";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.5,
  lng: 127.8,
  label: "전국 지도 중심"
};
const RESULT_LIMIT_OPTIONS = [30, 50, 100] as const;
const TAG_LABELS: Record<string, string> = {
  babyChair: "아기의자",
  childrenRoom: "어린이자료실",
  diaperChangingTable: "기저귀갈이대",
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

export type CategoryGroupSummary = {
  iconName: string;
  label: string;
};

type ExploreResultsProps = {
  activeCategoryGroup: string;
  activeCategoryGroupLabel: string;
  activeSort: Extract<SearchPlacesInput["sort"], "recommended" | "distance">;
  categoryGroups: Record<string, CategoryGroupSummary>;
  initialInput: SearchPlacesInput;
  initialParams: Record<string, string | string[]>;
  initialResult: SearchResult;
};

type SearchResult = {
  error?: string;
  items: SearchItem[];
  meta: SearchResultMeta;
};

type PendingSearchKind = "filters" | "location" | "viewport";

type SearchResultMeta = {
  count: number;
  limit: number;
  offset: number;
  origin: {
    label?: string | null;
    lat: number;
    lng: number;
  } | null;
  search?: SearchMeta | null;
  total: number;
};

type SearchMeta = {
  appliedPreferences: SearchPlacesInput["preferences"] | null;
  locationQuery: string | null;
  normalized: boolean;
  normalizedQuery: string | null;
  originalQuery: string | null;
  preferenceSemantics: {
    hardFilteringSupported: boolean;
    mismatchesRemainEligible: boolean;
    mode: "soft" | "required";
    requestedKeys: string[];
    unknownValuesRemainEligible: boolean;
  };
  suggestedExactNameQuery: string | null;
  temporalTerms: string[];
  visitContext: SearchPlacesInput["visitContext"] | null;
};

type SearchItem = {
  distanceKm: number | null;
  facilities: {
    babyChair: string;
    diaperChangingTable: string;
    elevator?: string;
    indoorType: string;
    nursingRoom: string;
    parkingAvailable: string;
    strollerFriendly: string;
  };
  lat: number;
  lng: number;
  name: string;
  openingHoursSummary: SearchResultBadgeOpeningHoursSummary;
  placeId: string;
  playFeatures?: Record<string, unknown> | null;
  pricing?: unknown;
  primaryCategory: string;
  primaryImage?: {
    url: string;
  } | null;
  recommendationReadiness?: SearchResultBadgeRecommendationReadiness | null;
  score: number;
  sourceSummary: SearchResultBadgeSourceSummary;
  tags: string[];
  userRatingSummary?: {
    averageRating: number | null;
    latestVisitedOn: string | null;
    publicPhotoCount: number;
    publicReviewCount: number;
    ratingCount: number;
  };
  visit?: {
    childEngagementLevel?: number | null;
    parentEffortLevel?: number | null;
  };
};

export function ExploreResults({
  activeCategoryGroup,
  activeCategoryGroupLabel,
  activeSort,
  categoryGroups,
  initialInput,
  initialParams,
  initialResult
}: ExploreResultsProps) {
  const [result, setResult] = useState(initialResult);
  const [activeInput, setActiveInput] = useState(initialInput);
  const [activeParams, setActiveParams] = useState(initialParams);
  const [pendingSearchKind, setPendingSearchKind] = useState<PendingSearchKind | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const searchReturnHref = useMemo(() => currentSearchHref(activeParams), [activeParams]);
  const isClientSearchPending = pendingSearchKind !== null;

  useEffect(() => {
    setResult(initialResult);
    setActiveInput(initialInput);
    setActiveParams(initialParams);
    setClientError(null);
    setPendingSearchKind(null);
  }, [initialInput, initialParams, initialResult]);

  const runClientSearch = useCallback(async (input: SearchPlacesInput, nextParams?: SearchParamsRecord, pendingKind: PendingSearchKind = "viewport") => {
    const scrollY = window.scrollY;
    setPendingSearchKind(pendingKind);
    setClientError(null);
    try {
      const response = await fetch("/places/search", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `검색 요청 실패 (${response.status})`);
      }

      const nextResult = (await response.json()) as SearchResult;
      setActiveInput(input);
      setResult(nextResult);
      if (nextParams) {
        setActiveParams(nextParams);
        replaceCurrentSearchParams(nextParams);
        syncSearchFormLocationInputs(nextParams);
      }
      restoreScrollPosition(scrollY);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setPendingSearchKind(null);
      restoreScrollPosition(scrollY);
    }
  }, []);

  useEffect(() => {
    function handleClientSearch(event: Event) {
      const params = (event as CustomEvent<ClientSearchEventDetail>).detail?.params;
      if (!params) return;

      const input = searchPlacesSchema.parse(buildSearchInput(params));
      void runClientSearch(input, params, "filters");
    }

    window.addEventListener(CLIENT_SEARCH_EVENT, handleClientSearch);
    return () => window.removeEventListener(CLIENT_SEARCH_EVENT, handleClientSearch);
  }, [runClientSearch]);

  const handleViewportSearch = useCallback(
    (request: ViewportSearchRequest) => {
      const nextParams = searchParamsForViewportSearch(activeParams, request);
      const nextInput = {
        ...activeInput,
        filterByRadius: false,
        offset: 0,
        origin: {
          lat: request.center.lat,
          lng: request.center.lng,
          label: "지도 중심"
        },
        viewportBounds: request.bounds
      } satisfies SearchPlacesInput;

      void runClientSearch(nextInput, nextParams, "viewport");
    },
    [activeInput, activeParams, runClientSearch]
  );

  const handleLocationSearch = useCallback(
    (location: { lat: number; lng: number }) => {
      const sort = homeSort(activeInput.sort, activeSort);
      const nextParams = searchParamsForCurrentLocation(activeParams, location, { sort });
      const nextInput = {
        ...activeInput,
        filterByRadius: true,
        offset: 0,
        origin: {
          lat: location.lat,
          lng: location.lng,
          label: "현재 위치"
        },
        radiusKm: activeInput.radiusKm ?? 80,
        sort,
        viewportBounds: undefined
      } satisfies SearchPlacesInput;

      void runClientSearch(nextInput, nextParams, "location");
    },
    [activeInput, activeParams, activeSort, runClientSearch]
  );

  const handlePage = useCallback(
    (page: number) => {
      const limit = activeInput.limit ?? result.meta.limit;
      void runClientSearch({
        ...activeInput,
        limit,
        offset: Math.min((page - 1) * limit, 1000)
      });
    },
    [activeInput, result.meta.limit, runClientSearch]
  );

  const mapOrigin = mapOriginFromMeta(result.meta);
  const mapPlaces = result.items.map((place) => mapPlaceForMap(place, searchReturnHref));
  const shownError = clientError ?? result.error;

  if (shownError) {
    return <SearchErrorState message={shownError} params={initialParams} />;
  }

  return (
    <section className="explore-layout">
      <PlacesMap
        isViewportSearchPending={isClientSearchPending}
        onLocationSearch={handleLocationSearch}
        onViewportSearch={handleViewportSearch}
        origin={mapOrigin}
        places={mapPlaces}
        preserveViewOnUpdate
      />
      <div className="results-panel">
        <section className="result-header">
          <h2 className="sr-only">{activeCategoryGroup === "all" ? "검색 결과" : `${activeCategoryGroupLabel} 검색 결과`}</h2>
          <span className="result-count-chip" aria-label={resultCountLabel(result.meta)}>
            {compactResultCountLabel(result.meta)}
          </span>
          <div className="result-actions">
            <SortControls activeSort={homeSort(activeInput.sort, activeSort)} params={activeParams} />
            <LimitControls activeLimit={resultLimitParam(activeParams)} params={activeParams} />
          </div>
        </section>
        <SearchInterpretation meta={result.meta.search} params={activeParams} />

        <div className="results-scroll" data-results-scroll>
          {pendingSearchKind ? <div className="results-inline-status">{pendingStatusLabel(pendingSearchKind)}</div> : null}
          <div className="results">
            {result.items.map((place, index) => (
              <ResultCard index={result.meta.offset + index + 1} place={place} returnHref={searchReturnHref} key={place.placeId} />
            ))}
            {result.items.length === 0 ? (
              <SearchEmptyState activeCategoryGroup={activeCategoryGroup} categoryGroups={categoryGroups} params={activeParams} />
            ) : null}
          </div>
        </div>
        <Pagination meta={result.meta} onPage={handlePage} />
      </div>
    </section>
  );
}

function SearchInterpretation({ meta, params }: { meta: SearchMeta | null | undefined; params: Record<string, string | string[]> }) {
  const chips = searchInterpretationChips(meta);
  const requiredHref = meta?.preferenceSemantics.mode === "soft" && meta.preferenceSemantics.requestedKeys.length > 0 ? requiredPreferenceModeHref(params) : null;

  if (chips.length === 0 && !requiredHref) return null;

  return (
    <section className="search-interpretation-panel" aria-label="검색 해석">
      <div className="search-interpretation-chips">
        {chips.map((chip, index) => (
          <span className={chip.tone ? `search-interpretation-chip ${chip.tone}` : "search-interpretation-chip"} key={`${chip.label}-${chip.value}-${index}`}>
            <strong>{chip.label}</strong>
            {chip.value}
          </span>
        ))}
      </div>
      {requiredHref ? (
        <Link className="search-interpretation-action" href={requiredHref}>
          필수 조건으로
        </Link>
      ) : null}
    </section>
  );
}

function SearchErrorState({ message, params }: { message: string; params: Record<string, string | string[]> }) {
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

function SearchEmptyState({
  activeCategoryGroup,
  categoryGroups,
  params
}: {
  activeCategoryGroup: string;
  categoryGroups: Record<string, CategoryGroupSummary>;
  params: Record<string, string | string[]>;
}) {
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
        {suggestedGroups.map((groupId) => (
          <Link className="empty-state-action" href={categoryGroupHref(params, groupId)} key={groupId}>
            {categoryGroups[groupId]?.label ?? groupId}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ResultCard({ index, place, returnHref }: { index: number; place: SearchItem; returnHref: string }) {
  const keywords = resultKeywordChips(place);
  const primaryImage = place.primaryImage;
  const priceLabel = pricingSummaryLabel(place.pricing);
  const category = categoryLabel(place.primaryCategory);
  const userRatingSummary = place.userRatingSummary;

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
        {userRatingSummary && userRatingSummary.ratingCount > 0 ? (
          <div className="trust-row">
            <span className="trust-badge positive result-rating-badge">
              <Star size={12} aria-hidden="true" />
              방문평가 {userRatingSummary.averageRating?.toFixed(1) ?? "-"} · {userRatingSummary.ratingCount}건
            </span>
            {userRatingSummary.publicReviewCount > 0 ? (
              <span className="trust-badge neutral">공개리뷰 {userRatingSummary.publicReviewCount}</span>
            ) : null}
            {userRatingSummary.publicPhotoCount > 0 ? (
              <span className="trust-badge neutral">공개사진 {userRatingSummary.publicPhotoCount}</span>
            ) : null}
          </div>
        ) : null}
        <SearchResultTrustBadges
          openingHoursSummary={place.openingHoursSummary}
          recommendationReadiness={place.recommendationReadiness}
          sourceSummary={place.sourceSummary}
        />
      </div>
    </Link>
  );
}

function SortControls({
  activeSort,
  params
}: {
  activeSort: Extract<SearchPlacesInput["sort"], "recommended" | "distance">;
  params: Record<string, string | string[]>;
}) {
  return (
    <nav className="sort-control" aria-label="목록 정렬">
      <Link className={`sort-option ${activeSort === "recommended" ? "is-active" : ""}`} href={sortHref(params, "recommended")}>
        관련도순
      </Link>
      <Link className={`sort-option ${activeSort === "distance" ? "is-active" : ""}`} href={sortHref(params, "distance")}>
        거리순
      </Link>
    </nav>
  );
}

function LimitControls({ activeLimit, params }: { activeLimit: (typeof RESULT_LIMIT_OPTIONS)[number]; params: Record<string, string | string[]> }) {
  return (
    <nav className="limit-control" aria-label="한 페이지 표시 개수">
      {RESULT_LIMIT_OPTIONS.map((limit) => (
        <Link className={`limit-option ${activeLimit === limit ? "is-active" : ""}`} href={limitHref(params, limit)} key={limit}>
          {limit}개
        </Link>
      ))}
    </nav>
  );
}

function Pagination({
  meta,
  onPage
}: {
  meta: SearchResultMeta;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const currentPage = Math.min(currentResultPage(meta), totalPages);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="검색 결과 페이지">
      {currentPage > 1 ? (
        <button className="page-control" type="button" onClick={() => onPage(currentPage - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
          이전
        </button>
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
            <button className="page-number" type="button" onClick={() => onPage(page)} key={page}>
              {page}
            </button>
          )
        )}
      </div>

      {currentPage < totalPages ? (
        <button className="page-control" type="button" onClick={() => onPage(currentPage + 1)}>
          다음
          <ChevronRight size={16} aria-hidden="true" />
        </button>
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

function resultCountLabel(meta: SearchResultMeta) {
  if (meta.total === 0 || meta.count === 0) {
    return `${meta.total}개 후보`;
  }

  const start = Math.min(meta.offset + 1, meta.total);
  const end = Math.min(meta.offset + meta.count, meta.total);
  return `${meta.total}개 중 ${start}-${end}번째`;
}

function compactResultCountLabel(meta: SearchResultMeta) {
  if (meta.total === 0 || meta.count === 0) {
    return "0곳";
  }

  const start = Math.min(meta.offset + 1, meta.total);
  const end = Math.min(meta.offset + meta.count, meta.total);
  return meta.total === meta.count ? `${meta.total}곳` : `${start}-${end} / ${meta.total}`;
}

function pendingStatusLabel(kind: PendingSearchKind) {
  if (kind === "location") return "현재 위치 기준으로 장소를 찾는 중입니다";
  if (kind === "filters") return "조건을 반영해 장소를 다시 찾는 중입니다";
  return "현재 지도 화면 안의 장소를 찾는 중입니다";
}

function currentResultPage(meta: SearchResultMeta) {
  return Math.floor(meta.offset / meta.limit) + 1;
}

function emptyStateCategoryGroups(activeCategoryGroup: string) {
  const suggestions = ["kidsCafe", "playground", "shopping", "visit"];
  return suggestions.filter((groupId) => groupId !== activeCategoryGroup);
}

function resultLimitParam(params: Record<string, string | string[]>) {
  const requested = Number(textParam(params.limit) || RESULT_LIMIT_OPTIONS[0]);
  return RESULT_LIMIT_OPTIONS.find((option) => option === requested) ?? RESULT_LIMIT_OPTIONS[0];
}

function searchInterpretationChips(meta: SearchMeta | null | undefined) {
  if (!meta) return [];

  const chips: Array<{ label: string; tone?: "is-soft" | "is-required"; value: string }> = [];
  if (meta.locationQuery) chips.push({ label: "지역", value: meta.locationQuery });
  if (meta.normalizedQuery && meta.normalizedQuery !== meta.locationQuery) chips.push({ label: "검색어", value: meta.normalizedQuery });
  if (meta.visitContext) chips.push({ label: "상황", value: visitContextLabel(meta.visitContext) });
  for (const term of meta.temporalTerms) chips.push({ label: "시점", value: temporalTermLabel(term) });
  for (const preference of preferenceLabels(meta.appliedPreferences, meta.preferenceSemantics.requestedKeys)) {
    chips.push({
      label: preference,
      tone: meta.preferenceSemantics.mode === "required" ? "is-required" : "is-soft",
      value: meta.preferenceSemantics.mode === "required" ? "필수" : "소프트"
    });
  }
  if (meta.suggestedExactNameQuery) chips.push({ label: "장소명", value: meta.suggestedExactNameQuery });

  return chips.slice(0, 8);
}

function preferenceLabels(preferences: SearchPlacesInput["preferences"] | null, requestedKeys: string[]) {
  const keys = requestedKeys.length > 0 ? requestedKeys : Object.keys(preferences ?? {});
  const labels: Record<string, string> = {
    babyChair: "아기의자",
    indoorTypes: "실내",
    kidsToilet: "유아화장실",
    nursingRoom: "수유실",
    parkingAvailable: "주차",
    strollerFriendly: "유모차"
  };

  return keys.map((key) => labels[key] ?? formatKeyword(key)).filter(Boolean);
}

function temporalTermLabel(term: string) {
  const labels: Record<string, string> = {
    비오는날: "비오는 날",
    우천: "비오는 날",
    장마: "비오는 날"
  };
  return labels[term] ?? term;
}

function visitContextLabel(context: NonNullable<SearchPlacesInput["visitContext"]>) {
  const labels: Record<NonNullable<SearchPlacesInput["visitContext"]>, string> = {
    afterDaycare: "하원 후",
    dayTrip: "당일치기",
    nearbyNow: "근처",
    rainyDay: "비오는 날",
    weekendHalfDay: "주말 반나절"
  };
  return labels[context];
}

function homeSort(sort: SearchPlacesInput["sort"], fallback: Extract<SearchPlacesInput["sort"], "recommended" | "distance">) {
  return sort === "recommended" || sort === "distance" ? sort : fallback;
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
    [place.facilities.diaperChangingTable, "기저귀갈이대"],
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
    unknown: ""
  };
  return labels[value] ?? "";
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

function hasRelaxableParams(params: Record<string, string | string[]>) {
  return Array.from(RELAXED_SEARCH_PARAM_KEYS).some((key) => Boolean(textParam(params[key])));
}

function relaxedSearchHref(params: Record<string, string | string[]>): UrlObject {
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

function categoryGroupHref(params: Record<string, string | string[]>, group: string): UrlObject {
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

  if (group !== "all") {
    query.categoryGroups = group;
  }

  return { pathname: "/", query };
}

function sortHref(params: Record<string, string | string[]>, sort: Extract<SearchPlacesInput["sort"], "recommended" | "distance">): UrlObject {
  const query = queryWithout(params, ["page", "offset", "sort", "visitContext"]);
  query.sort = sort;
  return { pathname: "/", query };
}

function limitHref(params: Record<string, string | string[]>, limit: (typeof RESULT_LIMIT_OPTIONS)[number]): UrlObject {
  const query = queryWithout(params, ["page", "offset", "limit", "visitContext"]);
  query.limit = String(limit);
  return { pathname: "/", query };
}

function requiredPreferenceModeHref(params: Record<string, string | string[]>): UrlObject {
  const query = queryWithout(params, ["page", "offset", "preferenceMode", "visitContext"]);
  query.preferenceMode = "required";
  return { pathname: "/", query };
}

function currentSearchHref(params: Record<string, string | string[]>) {
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

function replaceCurrentSearchParams(params: SearchParamsRecord) {
  const search = searchParamsRecordToQuery(params).toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function syncSearchFormLocationInputs(params: SearchParamsRecord) {
  const form = document.querySelector<HTMLFormElement>("form.search-form");
  if (!form) return;

  for (const key of MAP_LOCATION_PARAM_KEYS) {
    const value = textParam(params[key]);
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${key}"]`));

    if (!value) {
      inputs.forEach((input) => input.remove());
      continue;
    }

    const input = inputs[0] ?? document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    if (!inputs[0]) form.prepend(input);
    inputs.slice(1).forEach((duplicate) => duplicate.remove());
  }
}

function searchParamsRecordToQuery(params: SearchParamsRecord) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, item));
      continue;
    }
    if (value) query.set(key, value);
  }

  return query;
}

function currentSearchUrlObject(params: Record<string, string | string[]>): UrlObject {
  return { pathname: "/", query: queryWithout(params, ["offset", "returnTo", "visitContext"]) };
}

function queryWithout(params: Record<string, string | string[]>, excludedKeys: string[]) {
  const excluded = new Set(excludedKeys);
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    if (excluded.has(key)) continue;
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

  return query;
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function restoreScrollPosition(scrollY: number) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
    });
  });
}
