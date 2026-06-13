"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import type { UrlObject } from "url";
import { ArrowUp, Blocks, ChevronLeft, ChevronRight, CircleAlert, MapPin, RotateCcw, SearchX, SlidersHorizontal, Star, Target, X } from "lucide-react";

import { placeCategoryLabel } from "@/app/place-category-badge";
import { PlaceResultCard, type PlaceResultCardMetric } from "@/app/place-result-card";
import { PlaceSaveControlsProvider } from "@/app/places/place-save-controls";
import { PlacesMap, type MapHomeLocation, type MapOrigin, type MapPlace, type ViewportSearchRequest } from "@/app/places-map";
import { RESULT_LIMIT_OPTIONS, buildSearchInput, type HomeSearchSort } from "@/app/home-search-state";
import { buildLocationSearchState } from "@/app/location-search-state";
import {
  placeQualityScoreTitle,
  resultScoreRowLabel,
  searchRelevanceScoreTitle
} from "@/app/result-score-labels";
import {
  CLIENT_SEARCH_EVENT,
  MAP_LOCATION_PARAM_KEYS,
  searchParamsForViewportSearch,
  searchParamsWithQueryValue,
  type ClientSearchEventDetail,
  type SearchParamsRecord
} from "@/app/search-url-state";
import {
  type SearchResultBadgeOpeningHoursSummary,
  type SearchResultBadgeRecommendationReadiness,
  type SearchResultBadgeSourceSummary
} from "@/app/search-result-badges";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.5,
  lng: 127.8,
  label: "전국 지도 중심"
};
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
const RELAXED_SEARCH_PARAM_KEYS = new Set([
  "babyChair",
  "indoor",
  "maxLat",
  "maxLng",
  "minLat",
  "minLng",
  "nursing",
  "offset",
  "page",
  "parking",
  "accommodationType",
  "publicFacility",
  "sandPlay",
  "stroller",
  "toiletNearby",
  "waterPlay",
  "diaperChangingTable",
  "kidsToilet",
  "babyChair",
  "preferenceMode"
]);

export type CategoryGroupSummary = {
  iconName: string;
  label: string;
};

type ExploreResultsProps = {
  activeCategoryGroup: string;
  activeCategoryGroupLabel: string;
  activeSort: HomeSearchSort;
  autoLocateOnInitialLoad?: boolean;
  categoryGroups: Record<string, CategoryGroupSummary>;
  homeLocation?: MapHomeLocation | null;
  initialInput: SearchPlacesInput;
  initialParams: Record<string, string | string[]>;
  initialResult: SearchResult;
};

export type SearchResult = {
  error?: string;
  items: SearchItem[];
  meta: SearchResultMeta;
};

type PendingSearchKind = "filters" | "location" | "viewport";
type ResultCardMetricKey = "distance" | "relevance" | "evaluation";

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
  appliedTaxonomy: SearchPlacesInput["taxonomy"] | null;
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

export type SearchItem = {
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
  status?: string;
  playFeatures?: Record<string, unknown> | null;
  pricing?: unknown;
  primaryCategory: string;
  primaryImage?: {
    url: string;
  } | null;
  recommendationReadiness?: SearchResultBadgeRecommendationReadiness | null;
  reasons?: Array<{ labelKo?: string } | string>;
  score: number;
  placeQualityScore?: {
    rationale: string | null;
    score: number;
    storedScore: number | null;
  } | null;
  sourceSummary: SearchResultBadgeSourceSummary;
  tags: string[];
  notes?: {
    parent?: string | null;
    safety?: string | null;
  } | null;
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
  autoLocateOnInitialLoad = false,
  categoryGroups,
  homeLocation,
  initialInput,
  initialParams,
  initialResult
}: ExploreResultsProps) {
  const [result, setResult] = useState(initialResult);
  const [activeInput, setActiveInput] = useState(initialInput);
  const [activeParams, setActiveParams] = useState(initialParams);
  const [pendingSearchKind, setPendingSearchKind] = useState<PendingSearchKind | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const searchQueryRef = useRef(searchQueryParam(initialParams));
  const [showScrollTop, setShowScrollTop] = useState(false);
  const searchReturnHref = useMemo(() => currentSearchHref(activeParams), [activeParams]);
  const isClientSearchPending = pendingSearchKind !== null;

  useEffect(() => {
    setResult(initialResult);
    setActiveInput(initialInput);
    setActiveParams(initialParams);
    searchQueryRef.current = searchQueryParam(initialParams);
    setClientError(null);
    setPendingSearchKind(null);
  }, [initialInput, initialParams, initialResult]);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('form.search-form input[name="query"]');
    if (!input) return;

    function updateSearchQuery() {
      searchQueryRef.current = input?.value ?? "";
    }

    updateSearchQuery();
    input.addEventListener("input", updateSearchQuery);
    input.addEventListener("change", updateSearchQuery);
    return () => {
      input.removeEventListener("input", updateSearchQuery);
      input.removeEventListener("change", updateSearchQuery);
    };
  }, []);

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
      resetResultsScrollPosition(resultsScrollRef.current);
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

  useEffect(() => {
    const resultsScroll = resultsScrollRef.current;
    const resultsPanel = resultsPanelRef.current;

    function updateScrollTopVisibility() {
      const panelTop = resultsPanel ? resultsPanel.getBoundingClientRect().top : 0;
      setShowScrollTop((resultsScroll?.scrollTop ?? 0) > 280 || panelTop < -280);
    }

    updateScrollTopVisibility();
    resultsScroll?.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    window.addEventListener("resize", updateScrollTopVisibility);

    return () => {
      resultsScroll?.removeEventListener("scroll", updateScrollTopVisibility);
      window.removeEventListener("scroll", updateScrollTopVisibility);
      window.removeEventListener("resize", updateScrollTopVisibility);
    };
  }, []);

  const scrollResultsToTop = useCallback(() => {
    const resultsScroll = resultsScrollRef.current;
    const scrollsInternally = resultsScroll ? getComputedStyle(resultsScroll).overflowY !== "visible" : false;

    if (resultsScroll && scrollsInternally) {
      resultsScroll.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const panelTop = resultsPanelRef.current ? resultsPanelRef.current.getBoundingClientRect().top + window.scrollY - 12 : 0;
    window.scrollTo({ top: Math.max(panelTop, 0), behavior: "smooth" });
  }, []);

  const handleViewportSearch = useCallback(
    (request: ViewportSearchRequest) => {
      const nextParams = searchParamsForViewportSearch(searchParamsWithQueryValue(activeParams, searchQueryRef.current), request);
      const nextSearchInput = searchPlacesSchema.parse(buildSearchInput(nextParams));
      const nextInput = {
        ...nextSearchInput,
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
    [activeParams, runClientSearch]
  );

  const handleLocationSearch = useCallback(
    (location: { lat: number; lng: number }) => {
      const next = buildLocationSearchState({
        activeInput,
        activeParams,
        activeSort,
        formQuery: searchQueryRef.current,
        kind: "current",
        location
      });

      void runClientSearch(next.input, next.params, "location");
    },
    [activeInput, activeParams, activeSort, runClientSearch]
  );

  const handleHomeLocationSearch = useCallback(
    (location: { lat: number; lng: number }) => {
      const next = buildLocationSearchState({
        activeInput,
        activeParams,
        activeSort,
        formQuery: searchQueryRef.current,
        kind: "home",
        location
      });

      void runClientSearch(next.input, next.params, "location");
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

  const handleClearLocationScope = useCallback(() => {
    const nextParams = searchParamsWithoutLocationScope(searchParamsWithQueryValue(activeParams, searchQueryRef.current));
    const nextInput = searchPlacesSchema.parse(buildSearchInput(nextParams));
    void runClientSearch(
      {
        ...nextInput,
        filterByRadius: false,
        offset: 0,
        viewportBounds: undefined
      },
      nextParams,
      "filters"
    );
  }, [activeParams, runClientSearch]);

  const mapOrigin = mapOriginFromMeta(result.meta);
  const mapPlaces = result.items.map(mapPlaceForMap);
  const shownError = clientError ?? result.error;

  if (shownError) {
    return <SearchErrorState message={shownError} params={initialParams} />;
  }

  return (
    <section className="explore-layout">
      <PlacesMap
        autoLocateOnInitialLoad={autoLocateOnInitialLoad}
        homeLocation={homeLocation}
        isViewportSearchPending={isClientSearchPending}
        onHomeLocationSearch={handleHomeLocationSearch}
        onLocationSearch={handleLocationSearch}
        onViewportSearch={handleViewportSearch}
        origin={mapOrigin}
        places={mapPlaces}
        preserveViewOnUpdate
      />
      <div className="results-panel" ref={resultsPanelRef}>
        <section className="result-header">
          <h2 className="sr-only">{activeCategoryGroup === "all" ? "검색 결과" : `${activeCategoryGroupLabel} 검색 결과`}</h2>
          <LocationScopeIndicator input={activeInput} onClear={handleClearLocationScope} />
          <div className="result-actions">
            <SortControls activeSort={homeSort(activeInput.sort, activeSort)} params={activeParams} />
          </div>
        </section>
        <SearchInterpretation meta={result.meta.search} />

        <div className="results-scroll" data-results-scroll ref={resultsScrollRef}>
          {pendingSearchKind ? <div className="results-inline-status">{pendingStatusLabel(pendingSearchKind)}</div> : null}
          <PlaceSaveControlsProvider placeIds={result.items.map((place) => place.placeId)}>
            <div className="results">
              {result.items.map((place, index) => (
                <ResultCard index={result.meta.offset + index + 1} place={place} returnHref={searchReturnHref} key={place.placeId} />
              ))}
              {result.items.length === 0 ? (
                <SearchEmptyState activeCategoryGroup={activeCategoryGroup} categoryGroups={categoryGroups} params={activeParams} />
              ) : null}
            </div>
          </PlaceSaveControlsProvider>
        </div>
        {showScrollTop ? (
          <button className="result-scroll-top-button" type="button" onClick={scrollResultsToTop} aria-label="검색 결과 맨 위로 이동" title="검색 결과 맨 위로">
            <ArrowUp size={17} aria-hidden="true" />
            <span>맨 위</span>
          </button>
        ) : null}
        <ResultFooter meta={result.meta} onPage={handlePage} params={activeParams} />
      </div>
    </section>
  );
}

export function ResultsListPanel({
  className,
  emptyState,
  header,
  metricKeys,
  pathname = "/",
  params,
  result,
  returnHref,
  showFooter = true
}: {
  className?: string;
  emptyState: ReactNode;
  header: ReactNode;
  metricKeys?: ResultCardMetricKey[];
  pathname?: string;
  params: Record<string, string | string[]>;
  result: SearchResult;
  returnHref: string;
  showFooter?: boolean;
}) {
  const router = useRouter();
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const handlePage = useCallback(
    (page: number) => {
      const limit = result.meta.limit;
      const query = queryWithout(params, ["page", "offset"]);
      query.page = String(page);
      query.offset = String(Math.min((page - 1) * limit, 1000));
      router.push(searchHref(pathname, query) as Route);
      resetResultsScrollPosition(resultsScrollRef.current);
    },
    [params, pathname, result.meta.limit, router]
  );

  return (
    <div className={`results-panel ${className ?? ""}`}>
      <section className="result-header">{header}</section>
      <div className="results-scroll" data-results-scroll ref={resultsScrollRef}>
        <PlaceSaveControlsProvider placeIds={result.items.map((place) => place.placeId)}>
          <div className="results">
            {result.items.map((place, index) => (
              <ResultCard index={result.meta.offset + index + 1} metricKeys={metricKeys} place={place} returnHref={returnHref} key={place.placeId} />
            ))}
            {result.items.length === 0 ? emptyState : null}
          </div>
        </PlaceSaveControlsProvider>
      </div>
      {showFooter ? <ResultFooter meta={result.meta} onPage={handlePage} params={params} pathname={pathname} /> : null}
    </div>
  );
}

function ResultFooter({
  meta,
  onPage,
  pathname = "/",
  params
}: {
  meta: SearchResultMeta;
  onPage: (page: number) => void;
  pathname?: string;
  params: Record<string, string | string[]>;
}) {
  return (
    <section className="result-footer" aria-label="검색 결과 페이지 설정">
      <span className="result-count-chip" aria-label={resultCountLabel(meta)}>
        {compactResultCountLabel(meta)}
      </span>
      <Pagination meta={meta} onPage={onPage} />
      <LimitControls activeLimit={resultLimitParam(params)} params={params} pathname={pathname} />
    </section>
  );
}

function SearchInterpretation({ meta }: { meta: SearchMeta | null | undefined }) {
  const chips = searchInterpretationChips(meta);

  if (chips.length === 0) return null;

  return (
    <section className="search-interpretation-panel" aria-label="검색 해석">
      <div className="search-interpretation-chips">
        {chips.map((chip, index) => (
          <span className={chip.tone ? `search-interpretation-chip ${chip.tone}` : "search-interpretation-chip"} key={`${chip.label}-${chip.value}-${index}`}>
            <strong>{chip.label}</strong>
            {chip.value ? <span>{chip.value}</span> : null}
          </span>
        ))}
      </div>
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

export function ResultCard({
  index,
  metricKeys,
  place,
  returnHref
}: {
  index: number;
  metricKeys?: ResultCardMetricKey[];
  place: SearchItem;
  returnHref: string;
}) {
  const keywords = resultKeywordChips(place);
  const primaryImage = place.primaryImage;
  const category = placeCategoryLabel(place.primaryCategory);
  const summary = resultCardSummary(place, category, keywords);
  const metrics = resultCardMetrics(place, metricKeys);

  return (
    <PlaceResultCard
      category={place.primaryCategory}
      href={placeDetailHref(place.placeId, returnHref)}
      id={`place-card-${place.placeId}`}
      imageAlt={`${place.name} 대표 이미지`}
      imageUrl={primaryImage?.url}
      keywords={keywords}
      mapLat={place.lat}
      mapLng={place.lng}
      metrics={metrics}
      metricAriaLabel={resultScoreRowLabel(place.score, place.placeQualityScore?.score)}
      name={place.name}
      placeId={place.placeId}
      rank={index}
      savePlaceId={place.placeId}
      showImageCategory
      summary={summary}
      tags={place.tags}
    />
  );
}

function SortControls({
  activeSort,
  params
}: {
  activeSort: HomeSearchSort;
  params: Record<string, string | string[]>;
}) {
  return (
    <nav className="sort-control" aria-label="목록 정렬">
      <span className="sort-control-label">
        <SlidersHorizontal size={13} aria-hidden="true" />
        <span className="sort-label-full">정렬기준</span>
        <span className="sort-label-short" aria-hidden="true">기준</span>
      </span>
      <Link className={`sort-option ${activeSort === "recommended" ? "is-active" : ""}`} href={sortHref(params, "recommended")}>
        <Target size={13} aria-hidden="true" />
        <span>관련도</span>
      </Link>
      <Link className={`sort-option ${activeSort === "distance" ? "is-active" : ""}`} href={sortHref(params, "distance")}>
        <MapPin size={13} aria-hidden="true" />
        <span>거리</span>
      </Link>
      <Link className={`sort-option ${activeSort === "rating" ? "is-active" : ""}`} href={sortHref(params, "rating")}>
        <Star size={13} aria-hidden="true" />
        <span>평가</span>
      </Link>
    </nav>
  );
}

function LocationScopeIndicator({ input, onClear }: { input: SearchPlacesInput; onClear: () => void }) {
  const label = locationScopeLabel(input);
  if (!label) return <span aria-hidden="true" />;

  return (
    <span className="location-scope-chip" aria-label={`${label} 필터 적용됨`}>
      <MapPin size={14} aria-hidden="true" />
      <span>{label}</span>
      <button className="location-scope-clear" type="button" onClick={onClear} aria-label={`${label} 필터 해제`} title="거리 필터 해제">
        <X size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

function LimitControls({
  activeLimit,
  params,
  pathname = "/"
}: {
  activeLimit: (typeof RESULT_LIMIT_OPTIONS)[number];
  params: Record<string, string | string[]>;
  pathname?: string;
}) {
  return (
    <nav className="limit-control" aria-label="한 페이지 표시 개수">
      {RESULT_LIMIT_OPTIONS.map((limit) => (
        <Link className={`limit-option ${activeLimit === limit ? "is-active" : ""}`} href={limitHref(params, limit, pathname)} key={limit}>
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

function locationScopeLabel(input: SearchPlacesInput) {
  if (input.viewportBounds) return "지도 화면 안";
  if (!input.origin || input.filterByRadius === false || typeof input.radiusKm !== "number") return null;

  return `반경 ${distanceRadiusLabel(input.radiusKm)}`;
}

function distanceRadiusLabel(radiusKm: number) {
  return Number.isInteger(radiusKm) ? `${radiusKm}km` : `${radiusKm.toFixed(1)}km`;
}

function searchInterpretationChips(meta: SearchMeta | null | undefined) {
  if (!meta) return [];

  const chips: Array<{ label: string; tone?: "is-soft" | "is-required"; value?: string }> = [];
  if (meta.locationQuery) chips.push({ label: "지역", value: meta.locationQuery });
  if (meta.normalizedQuery && meta.normalizedQuery !== meta.locationQuery) chips.push({ label: "검색어", value: meta.normalizedQuery });
  if (meta.visitContext) chips.push({ label: "상황", value: visitContextLabel(meta.visitContext) });
  for (const term of meta.temporalTerms) chips.push({ label: "시점", value: temporalTermLabel(term) });
  for (const preference of preferenceLabels(meta.appliedPreferences, meta.preferenceSemantics.requestedKeys)) {
    chips.push({
      label: preference,
      tone: "is-soft"
    });
  }
  for (const taxonomy of taxonomyLabels(meta.appliedTaxonomy)) {
    chips.push({
      label: taxonomy,
      tone: "is-soft"
    });
  }
  if (meta.suggestedExactNameQuery) chips.push({ label: "장소명", value: meta.suggestedExactNameQuery });

  return chips.slice(0, 8);
}

function taxonomyLabels(taxonomy: SearchPlacesInput["taxonomy"] | null | undefined) {
  const activityLabels: Record<string, string> = {
    sand_play: "모래놀이",
    water_play: "물놀이"
  };

  return [
    ...(taxonomy?.activityTypes ?? []).map((value) => activityLabels[value] ?? formatKeyword(value)),
    ...(taxonomy?.visitUseCases ?? []).map((value) => formatKeyword(value)),
    ...(taxonomy?.familyFitGates ?? []).map((value) => formatKeyword(value)),
    ...(taxonomy?.logisticsTags ?? []).map((value) => formatKeyword(value)),
    ...(taxonomy?.ageBands ?? []).map((value) => formatKeyword(value))
  ].filter(Boolean);
}

function preferenceLabels(preferences: SearchPlacesInput["preferences"] | null, requestedKeys: string[]) {
  const keys = requestedKeys.length > 0 ? requestedKeys : Object.keys(preferences ?? {});
  const labels: Record<string, string> = {
    babyChair: "아기의자",
    diaperChangingTable: "기저귀갈이대",
    elevator: "엘리베이터",
    foodAllowed: "간식 가능",
    indoorTypes: "실내",
    kidsToilet: "유아화장실",
    nursingRoom: "수유실",
    parkingAvailable: "주차",
    toiletNearby: "화장실",
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

function homeSort(sort: SearchPlacesInput["sort"], fallback: HomeSearchSort) {
  return sort === "recommended" || sort === "distance" || sort === "rating" ? sort : fallback;
}

function mapOriginFromMeta(meta: SearchResultMeta): MapOrigin {
  if (!meta.origin) return null;
  return {
    label: meta.origin.label ?? DEFAULT_ORIGIN.label,
    lat: meta.origin.lat,
    lng: meta.origin.lng
  };
}

function mapPlaceForMap(place: SearchItem): MapPlace {
  return {
    category: place.primaryCategory,
    distance: distanceLabel(place.distanceKm),
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    placeId: place.placeId
  };
}

function resultKeywordChips(place: SearchItem) {
  const keywords = [
    place.status === "temporarily_closed" ? "임시휴장" : null,
    indoorLabel(place.facilities.indoorType),
    ...positivePlayFeatureKeywords(place),
    ...positiveFacilityKeywords(place),
    ...place.tags.map(formatKeyword)
  ].filter((keyword): keyword is string => Boolean(keyword));

  return Array.from(new Set(keywords.filter((keyword) => !lowSignalResultKeyword(keyword)))).slice(0, 4);
}

function resultCardSummary(place: SearchItem, category: string, keywords: string[]) {
  const note = firstText([place.notes?.parent, place.notes?.safety]);
  if (note) return note;

  const reason = firstText(place.reasons?.map((reasonItem) => (typeof reasonItem === "string" ? reasonItem : reasonItem.labelKo)));
  if (reason) return reason;

  const keywordText = keywords.slice(0, 3).join(", ");
  return keywordText ? `${category} 후보 · ${keywordText} 중심으로 비교해볼 만한 곳` : `${category} 후보 · 가족 외출 기준으로 비교해볼 만한 곳`;
}

function resultCardMetrics(place: SearchItem, metricKeys?: ResultCardMetricKey[]): PlaceResultCardMetric[] {
  const qualityScore = place.placeQualityScore?.score ?? null;
  const userRating = place.userRatingSummary?.averageRating ?? null;
  const evaluationValue = qualityScore !== null ? String(Math.round(qualityScore)) : userRating !== null ? userRating.toFixed(1) : "-";
  const evaluationTitle = qualityScore !== null ? placeQualityScoreTitle(qualityScore) : "방문 평가 데이터가 충분하지 않습니다.";

  const requestedKeys = metricKeys ? new Set(metricKeys) : null;
  const metrics: PlaceResultCardMetric[] = [
    {
      icon: "distance",
      key: "distance",
      label: "",
      title: "검색 기준점에서의 직선 거리",
      tone: distanceTone(place.distanceKm),
      value: distanceLabel(place.distanceKm)
    },
    {
      icon: "relevance",
      key: "relevance",
      label: "관련도",
      title: searchRelevanceScoreTitle(place.score),
      tone: scoreTone(place.score),
      value: String(Math.round(place.score))
    },
    {
      icon: "evaluation",
      key: "evaluation",
      label: "평가",
      title: evaluationTitle,
      tone: qualityScore !== null ? scoreTone(qualityScore) : undefined,
      value: evaluationValue
    }
  ];

  return metrics.filter((metric) => !requestedKeys || requestedKeys.has(metric.key as ResultCardMetricKey));
}

function distanceTone(distanceKm: number | null) {
  if (distanceKm === null) return "distance-unknown";
  if (distanceKm <= 5) return "distance-near";
  if (distanceKm <= 20) return "distance-mid";
  return "distance-far";
}

function firstText(values: Array<string | null | undefined> | undefined) {
  const text = values?.find((value) => value && value.trim().length > 0)?.trim();
  if (!text) return null;
  const sentence = text.split(/[.!?。！？]\s*/)[0]?.trim() || text;
  return sentence.length > 92 ? `${sentence.slice(0, 91)}...` : sentence;
}

function lowSignalResultKeyword(keyword: string) {
  return /^(공식|공공|오늘|최근|확인|예약|회차|출처|운영정보|가격|관련도|평가)/.test(keyword) || keyword.length > 10;
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
  return value === null ? "미계산" : `${value.toFixed(1)}km`;
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

function sortHref(params: Record<string, string | string[]>, sort: HomeSearchSort): UrlObject {
  const query = queryWithout(params, ["page", "offset", "sort", "visitContext"]);
  query.sort = sort;
  return { pathname: "/", query };
}

function limitHref(params: Record<string, string | string[]>, limit: (typeof RESULT_LIMIT_OPTIONS)[number], pathname = "/"): UrlObject {
  const query = queryWithout(params, ["page", "offset", "limit", "visitContext"]);
  query.limit = String(limit);
  return { pathname, query };
}

function currentSearchHref(params: Record<string, string | string[]>) {
  return searchHref("/", params);
}

function searchHref(pathname: string, params: Record<string, string | string[]>) {
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
  return search ? `${pathname}?${search}` : pathname;
}

function searchParamsWithoutLocationScope(params: SearchParamsRecord) {
  const next = queryWithout(params, [...MAP_LOCATION_PARAM_KEYS, "page", "offset"]);
  if (textParam(next.sort) === "distance") next.sort = "recommended";
  return next;
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

function searchQueryParam(params: Record<string, string | string[]>) {
  const value = params.query;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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

function resetResultsScrollPosition(resultsScroll: HTMLDivElement | null) {
  if (!resultsScroll) return;

  resultsScroll.scrollTo({ top: 0, behavior: "instant" });
}
