import { ArrowRight, Building2, MapPinned, SearchX, Star } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { UrlObject } from "url";

import { PlaceImage } from "@/app/place-image";
import { PlaceCategoryBadge, placeCategoryLabel } from "@/app/place-category-badge";
import { KOREA_REGIONS, REGION_MAJOR_CATEGORIES, regionBySlug, type RegionCatalogItem } from "@/app/regions/region-catalog";
import { buildSearchPreferenceSemantics, searchPlaces } from "@/lib/places";
import type { SearchPlacesInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RegionSearchResult = Awaited<ReturnType<typeof searchPlaces>>;
type RegionSearchItem = RegionSearchResult["items"][number];

const REGION_RESULT_LIMIT = 24;

export default async function RegionsPage({ searchParams }: RegionsPageProps) {
  const params = await searchParams;
  const selectedRegion = regionBySlug(textParam(params.region));
  const input = regionSearchInput(selectedRegion);
  const result = await safeRegionSearch(input);
  const returnHref = `/regions?region=${selectedRegion.slug}`;

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
            <Star size={15} aria-hidden="true" />
            평가순
          </span>
        </div>
      </header>

      <section className="regions-layout">
        <section className="region-map-panel" aria-label="지역 선택 지도">
          <div className="region-map-board" aria-label="대한민국 지역 선택">
            <div className="region-map-shape" aria-hidden="true" />
            {KOREA_REGIONS.map((region) => (
              <RegionMapLink active={region.slug === selectedRegion.slug} key={region.slug} region={region} />
            ))}
          </div>
        </section>

        <section className="region-results-panel" aria-label={`${selectedRegion.label} 대표 장소`}>
          <div className="region-results-head">
            <div>
              <p className="region-results-kicker">{selectedRegion.regionSido}</p>
              <h2>{selectedRegion.label} 대표 장소</h2>
            </div>
            <Link className="region-search-link" href={allSearchHref(selectedRegion)}>
              전체 검색
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          {result.error ? <RegionError message={result.error} /> : null}
          {!result.error && result.items.length === 0 ? <RegionEmptyState region={selectedRegion} /> : null}
          {!result.error && result.items.length > 0 ? (
            <div className="region-result-grid">
              {result.items.map((place) => (
                <RegionPlaceCard key={place.placeId} place={place} returnHref={returnHref} />
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}

function RegionMapLink({ active, region }: { active: boolean; region: RegionCatalogItem }) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      aria-label={`${region.label} 대표 장소 보기`}
      className={`region-map-pin ${active ? "is-active" : ""}`}
      href={{ pathname: "/regions", query: { region: region.slug } }}
      style={
        {
          "--region-x": `${region.mapPosition.x}%`,
          "--region-y": `${region.mapPosition.y}%`
        } as CSSProperties
      }
    >
      <span className="region-map-pin-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={region.imageSrc} alt="" loading={active ? "eager" : "lazy"} />
      </span>
      <span className="region-map-pin-label">{region.label}</span>
    </Link>
  );
}

function RegionPlaceCard({ place, returnHref }: { place: RegionSearchItem; returnHref: string }) {
  const evaluationScore = place.placeQualityScore?.score ?? null;
  const keywords = regionPlaceKeywords(place);

  return (
    <article className="region-place-card">
      <Link className="region-place-card-main" href={placeDetailHref(place.placeId, returnHref)}>
        <div className="region-place-image-frame">
          <PlaceImage category={place.primaryCategory} src={place.primaryImage?.url} alt={`${place.name} 대표 이미지`} variant="result" />
          <PlaceCategoryBadge category={place.primaryCategory} className="category-pill region-place-category" />
        </div>
        <div className="region-place-body">
          <div className="region-place-topline">
            <span className="region-score-pill" title={evaluationScore === null ? "평가 데이터가 충분하지 않습니다." : `평가 ${evaluationScore.toFixed(1)}`}>
              <Star size={13} aria-hidden="true" />
              {evaluationScore === null ? "-" : Math.round(evaluationScore)}
            </span>
            <span>{place.distanceKm === null ? "거리 미계산" : `${place.distanceKm.toFixed(1)}km`}</span>
          </div>
          <h3>{place.name}</h3>
          <p>{placeCategoryLabel(place.primaryCategory)} · {keywords.length > 0 ? keywords.join(", ") : "가족 방문처로 비교해볼 만한 곳"}</p>
        </div>
      </Link>
    </article>
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
        <Link className="empty-state-action is-primary" href={allSearchHref(region)}>
          전체 검색으로 보기
        </Link>
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

function regionSearchInput(region: RegionCatalogItem): SearchPlacesInput {
  return {
    diversity: { maxPerCategory: 4 },
    filterByRadius: false,
    limit: REGION_RESULT_LIMIT,
    offset: 0,
    origin: {
      lat: region.center.lat,
      lng: region.center.lng,
      label: region.label
    },
    primaryCategories: [...REGION_MAJOR_CATEGORIES],
    radiusKm: 80,
    regionSido: region.regionSido,
    sort: "rating"
  };
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

function regionPlaceKeywords(place: RegionSearchItem) {
  const keywords = [
    place.facilities.indoorType === "indoor" ? "실내" : place.facilities.indoorType === "mixed" ? "실내외" : "",
    place.facilities.parkingAvailable === "yes" ? "주차" : "",
    place.facilities.strollerFriendly === "yes" ? "유모차" : "",
    place.facilities.nursingRoom === "yes" ? "수유실" : "",
    ...place.tags.filter((tag) => /[가-힣]/.test(tag)).map((tag) => tag.replace(/[_-]+/g, " "))
  ];

  return Array.from(new Set(keywords.filter(Boolean))).slice(0, 3);
}

function placeDetailHref(placeId: string, returnHref: string): UrlObject {
  return {
    pathname: `/places/${placeId}`,
    query: { returnTo: returnHref }
  };
}

function allSearchHref(region: RegionCatalogItem): UrlObject {
  return {
    pathname: "/",
    query: {
      categoryGroups: ["visit", "shopping", "stay"],
      query: region.label,
      sort: "rating"
    }
  };
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
