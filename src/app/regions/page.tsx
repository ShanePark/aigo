import { Building2, MapPinned, SearchX, Target } from "lucide-react";

import { RESULT_LIMIT_OPTIONS } from "@/app/home-search-state";
import { ResultsListPanel } from "@/app/explore-results";
import { KOREA_REGIONS, REGION_MAJOR_CATEGORIES, regionBySlug, type RegionCatalogItem } from "@/app/regions/region-catalog";
import { RegionMap } from "@/app/regions/region-map";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import type { SearchPlacesInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RegionSearchResult = Awaited<ReturnType<typeof searchPlaces>>;

const DEFAULT_REGION_RESULT_LIMIT = RESULT_LIMIT_OPTIONS[0];

export default async function RegionsPage({ searchParams }: RegionsPageProps) {
  const params = await searchParams;
  const selectedRegion = regionBySlug(textParam(params.region));
  const input = regionSearchInput(selectedRegion, params);
  const result = await safeRegionSearch(input);
  const regionParams = regionSearchParams(selectedRegion, input);
  const returnHref = regionReturnHref(regionParams);

  return (
    <div className="page regions-page">
      <header className="regions-hero">
        <div>
          <p className="eyebrow">지역별 보기</p>
          <h1>지역을 누르면 대표 가족 방문처가 보여요</h1>
        </div>
        <div className="regions-hero-metrics" aria-label={`${selectedRegion.label} 대표 장소 요약`}>
          <span>
            <MapPinned size={15} aria-hidden="true" />
            {selectedRegion.label}
          </span>
          <span>
            <Building2 size={15} aria-hidden="true" />
            {result.meta.total}곳
          </span>
          <span>
            <Target size={15} aria-hidden="true" />
            대표순
          </span>
        </div>
      </header>

      <section className="regions-layout">
        <section className="region-map-panel" aria-label="지역 선택 지도">
          <RegionMap regions={KOREA_REGIONS} selectedSlug={selectedRegion.slug} />
          <RegionSpotlight region={selectedRegion} />
        </section>

        {result.error ? (
          <section className="region-results-panel region-results-error-panel" aria-label={`${selectedRegion.label} 대표 장소 오류`}>
            <div>
              <p className="region-results-kicker">{selectedRegion.regionSido}</p>
              <h2>{selectedRegion.label} 대표 장소</h2>
            </div>
            <RegionError message={result.error} />
          </section>
        ) : (
          <ResultsListPanel
            className="region-results-panel"
            emptyState={<RegionEmptyState region={selectedRegion} />}
            header={
              <div className="region-results-head">
                <div>
                  <p className="region-results-kicker">{selectedRegion.regionSido}</p>
                  <h2>{selectedRegion.label} 대표 장소</h2>
                </div>
                <span className="region-result-count">{result.meta.total}곳</span>
              </div>
            }
            params={regionParams}
            pathname="/regions"
            result={result}
            returnHref={returnHref}
          />
        )}
      </section>
    </div>
  );
}

function RegionSpotlight({ region }: { region: RegionCatalogItem }) {
  return (
    <section className="region-spotlight" aria-label={`${region.label} 지역 소개`}>
      <div className="region-spotlight-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={region.imageSrc} alt={region.imageAlt} />
      </div>
      <div className="region-spotlight-copy">
        <p>{region.regionSido}</p>
        <h2>{region.label}</h2>
        <span>{region.intro}</span>
      </div>
    </section>
  );
}

function RegionEmptyState({ region }: { region: RegionCatalogItem }) {
  return (
    <section className="empty-state region-empty-state" aria-live="polite">
      <div className="empty-state-icon">
        <SearchX size={24} aria-hidden="true" />
      </div>
      <div className="empty-state-copy">
        <p className="empty-state-kicker">결과 없음</p>
        <h3>{region.label} 대표 장소 데이터가 아직 부족합니다</h3>
      </div>
      <div className="empty-state-actions">
        <span className="empty-state-action is-primary">{region.regionSido}</span>
      </div>
    </section>
  );
}

function RegionError({ message }: { message: string }) {
  return (
    <section className="empty-state region-empty-state empty-state-error" aria-live="polite">
      <div className="empty-state-icon">
        <SearchX size={24} aria-hidden="true" />
      </div>
      <div className="empty-state-copy">
        <p className="empty-state-kicker">검색 오류</p>
        <h3>대표 장소를 불러오지 못했습니다</h3>
        <p>{message}</p>
      </div>
    </section>
  );
}

function regionSearchInput(region: RegionCatalogItem, params: Record<string, string | string[] | undefined>): SearchPlacesInput {
  return {
    diversity: { maxPerCategory: 4 },
    filterByRadius: false,
    limit: resultLimitParam(params.limit),
    offset: resultOffsetParam(params.offset),
    origin: {
      lat: region.center.lat,
      lng: region.center.lng,
      label: region.label
    },
    primaryCategories: [...REGION_MAJOR_CATEGORIES],
    radiusKm: 80,
    representativeVisit: true,
    regionSido: region.regionSido,
    sort: "recommended",
    visitContext: "weekendHalfDay"
  };
}

function regionSearchParams(region: RegionCatalogItem, input: SearchPlacesInput): Record<string, string> {
  return {
    limit: String(input.limit),
    offset: String(input.offset),
    region: region.slug
  };
}

function regionReturnHref(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/regions?${query.toString()}`;
}

async function safeRegionSearch(input: SearchPlacesInput): Promise<RegionSearchResult & { error?: string }> {
  try {
    return { ...(await searchPlaces(input)), error: undefined };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.",
      items: [],
      meta: {
        count: 0,
        coursePlan: null,
        limit: input.limit,
        offset: input.offset,
        origin: input.origin ?? null,
        projection: input.projection ?? "full",
        search: {
          appliedPreferences: input.preferences ?? null,
          appliedTaxonomy: input.taxonomy ?? null,
          locationQuery: null,
          normalized: false,
          normalizedQuery: input.query ?? null,
          originalQuery: input.query ?? null,
          preferenceSemantics: buildSearchPreferenceSemantics(input.preferences),
          queryNormalization: {
            hasPreservedIntent: false,
            preservedTaxonomyFacets: {},
            removedTerms: []
          },
          suggestedExactNameQuery: null,
          temporalTerms: [],
          visitContext: input.visitContext ?? null
        },
        total: 0
      }
    };
  }
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resultLimitParam(value: string | string[] | undefined) {
  const requested = Number(textParam(value) || DEFAULT_REGION_RESULT_LIMIT);
  return RESULT_LIMIT_OPTIONS.find((option) => option === requested) ?? DEFAULT_REGION_RESULT_LIMIT;
}

function resultOffsetParam(value: string | string[] | undefined) {
  const requested = Number(textParam(value) || 0);
  if (!Number.isFinite(requested) || requested < 0) return 0;
  return Math.min(Math.floor(requested), 1000);
}
