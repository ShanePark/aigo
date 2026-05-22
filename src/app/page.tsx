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
  MapPin,
  Search,
  SlidersHorizontal,
  TreePine,
  Utensils,
  type LucideIcon
} from "lucide-react";

import { NearbySearchButton } from "@/app/nearby-search-button";
import { PlaceImage } from "@/app/place-image";
import { PlacesMap, type MapOrigin, type MapPlace } from "@/app/places-map";
import { searchPlaces } from "@/lib/places";
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
    hint: "과학관/쇼핑",
    icon: Building2,
    categories: ["science_museum", "museum", "experience_center", "aquarium_zoo", "library", "toy_library", "shopping_mall", "sports_venue", "rest_area"]
  },
  playground: { label: "놀이터", hint: "공원/실내", icon: TreePine, categories: ["park", "indoor_playground"] },
  kidsCafe: { label: "키즈카페", hint: "놀이 카페", icon: Baby, categories: ["kids_cafe", "family_cafe"] },
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
  stroller: "유모차",
  toyLibrary: "장난감도서관",
  waterPlayground: "물놀이터"
};

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryGroupId = keyof typeof CATEGORY_GROUPS;

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const input = searchPlacesSchema.parse(buildSearchInput(params));
  const result = await safeSearch(input);
  const activeCategoryGroup = categoryGroupParam(params);
  const activeSort = sortParam(params);
  const mapOrigin = mapOriginFromMeta(result.meta);
  const mapPlaces = result.items.map(mapPlaceForMap);

  return (
    <div className="page">
      <section className="search-shell">
        <div className="search-copy">
          <p className="eyebrow">Daejeon family picks</p>
          <h1>지도에서 고르는 오늘의 외출</h1>
          <p className="lede">현재 위치나 대전역 기준으로 주변을 보고, 큰 분류만 톡톡 골라 빠르게 좁혀보세요.</p>
        </div>

        <form className="search-form" action="/">
          <input name="categoryGroup" type="hidden" value={activeCategoryGroup} />
          {textParam(params.nearby) === "1" ? <input name="nearby" type="hidden" value="1" /> : null}
          <div className="search-bar">
            <label className="query-field">
              <span>검색어</span>
              <input name="query" defaultValue={textParam(params.query)} placeholder="물놀이, 비 오는 날, 수유실..." />
            </label>
            <button type="submit" className="primary-button">
              <Search size={17} aria-hidden="true" />
              검색
            </button>
          </div>

          <div className="location-row">
            <NearbySearchButton />
            <span className="origin-pill">
              <MapPin size={14} aria-hidden="true" />
              {input.origin?.label ?? DEFAULT_ORIGIN.label}
            </span>
          </div>

          <div className="category-tabs" aria-label="큰 분류">
            {Object.entries(CATEGORY_GROUPS).map(([groupId, group]) => {
              const Icon = group.icon;

              return (
                <Link
                  className={`category-tab ${activeCategoryGroup === groupId ? "is-active" : ""}`}
                  href={categoryGroupHref(params, groupId as CategoryGroupId)}
                  key={groupId}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{group.label}</span>
                  <small>{group.hint}</small>
                </Link>
              );
            })}
          </div>

          <div className="filter-grid">
            <label>
              <span className="select-label">
                <ArrowUpDown size={13} aria-hidden="true" />
                정렬
              </span>
              <select name="sort" defaultValue={activeSort}>
                <option value="recommended">관련도순</option>
                <option value="distance">거리순</option>
              </select>
            </label>
            <label>
              <span>상황</span>
              <select name="visitContext" defaultValue={textParam(params.visitContext) || ""}>
                <option value="">기본 추천</option>
                <option value="afterDaycare">하원 후</option>
                <option value="nearbyNow">당장 근처</option>
                <option value="rainyDay">비 오는 날</option>
                <option value="weekendHalfDay">주말 반나절</option>
                <option value="dayTrip">주말 당일치기</option>
              </select>
            </label>
            <label>
              <span>한 페이지</span>
              <select name="limit" defaultValue={String(resultLimitParam(params))}>
                {RESULT_LIMIT_OPTIONS.map((limit) => (
                  <option value={limit} key={limit}>
                    {limit}개
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="checks" aria-label="선호 조건">
            <label className="check">
              <input name="indoor" type="checkbox" defaultChecked={params.indoor === "on"} />
              <span>실내</span>
            </label>
            <label className="check">
              <input name="parking" type="checkbox" defaultChecked={params.parking === "on"} />
              <span>주차</span>
            </label>
            <label className="check">
              <input name="stroller" type="checkbox" defaultChecked={params.stroller === "on"} />
              <span>유모차</span>
            </label>
            <label className="check">
              <input name="nursing" type="checkbox" defaultChecked={params.nursing === "on"} />
              <span>수유실</span>
            </label>
            <label className="check">
              <input name="diaper" type="checkbox" defaultChecked={params.diaper === "on"} />
              <span>기저귀</span>
            </label>
            <label className="check">
              <input name="food" type="checkbox" defaultChecked={params.food === "on"} />
              <span>간식</span>
            </label>
            <label className="check">
              <input name="babyChair" type="checkbox" defaultChecked={params.babyChair === "on"} />
              <span>아기의자</span>
            </label>
            <label className="check">
              <input name="elevator" type="checkbox" defaultChecked={params.elevator === "on"} />
              <span>엘리베이터</span>
            </label>
          </div>

          <details className="advanced-search">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              세부 조건
            </summary>
            <div className="advanced-grid">
              <label>
                <span>아이 월령</span>
                <input name="ages" defaultValue={textParam(params.ages) || "32,7,7"} placeholder="32,7,7" />
              </label>
              <label>
                <span>반경 km</span>
                <input name="radiusKm" type="number" min="1" max="200" defaultValue={textParam(params.radiusKm) || "80"} />
              </label>
              <label>
                <span>위도</span>
                <input name="lat" type="number" step="0.000001" defaultValue={textParam(params.lat) || String(DEFAULT_ORIGIN.lat)} />
              </label>
              <label>
                <span>경도</span>
                <input name="lng" type="number" step="0.000001" defaultValue={textParam(params.lng) || String(DEFAULT_ORIGIN.lng)} />
              </label>
            </div>
          </details>
        </form>
      </section>

      {result.error ? (
        <div className="notice">{result.error}</div>
      ) : (
        <section className="explore-layout">
          <PlacesMap origin={mapOrigin} places={mapPlaces} />
          <div className="results-panel">
            <section className="result-header">
              <div>
                <h2>주변 장소</h2>
                <p>{resultCountLabel(result.meta)}</p>
              </div>
              {result.meta.total > 0 ? <span className="page-badge">{currentResultPage(result.meta)}페이지</span> : null}
            </section>

            <div className="results">
              {result.items.map((place, index) => (
                <ResultCard index={result.meta.offset + index + 1} place={place} key={place.placeId} />
              ))}
              {result.items.length === 0 ? <div className="notice">아직 조건에 맞는 장소가 없습니다.</div> : null}
            </div>
            <Pagination meta={result.meta} params={params} />
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCard({ index, place }: { index: number; place: SearchItem }) {
  const keywords = resultKeywordChips(place);
  const primaryImage = place.primaryImage;

  return (
    <Link className="result-card" href={`/places/${place.placeId}`}>
      <PlaceImage src={primaryImage?.url} alt={`${place.name} 대표 이미지`} variant="result" />
      <div className="result-card-body">
        <div className="result-card-topline">
          <span className="rank-badge">{index}</span>
          <span className="score-pill">추천 {place.score}</span>
          <span className="distance-pill">
            <MapPin size={14} aria-hidden="true" />
            {distanceLabel(place.distanceKm)}
          </span>
        </div>
        <h3>{place.name}</h3>
        <div className="keyword-row" aria-label="키워드">
          {keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const lat = Number(textParam(params.lat) || DEFAULT_ORIGIN.lat);
  const lng = Number(textParam(params.lng) || DEFAULT_ORIGIN.lng);
  const category = textParam(params.category);
  const categoryGroup = categoryGroupParam(params);
  const groupCategories = CATEGORY_GROUPS[categoryGroup].categories;
  const limit = resultLimitParam(params);
  const page = currentPageParam(params);
  const nearby = textParam(params.nearby) === "1";
  const ages = (textParam(params.ages) || "32,7,7")
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isFinite(age));

  return {
    origin: { lat, lng, label: nearby ? "현재 위치" : DEFAULT_ORIGIN.label },
    visitContext: (textParam(params.visitContext) || undefined) as SearchPlacesInput["visitContext"],
    radiusKm: Number(textParam(params.radiusKm) || 80),
    query: textParam(params.query) || undefined,
    primaryCategories: groupCategories ? [...groupCategories] : category ? [category] : undefined,
    childAgeMonths: ages,
    preferences: {
      indoorTypes: params.indoor === "on" ? ["indoor", "mixed"] : undefined,
      parkingAvailable: params.parking === "on" ? true : undefined,
      strollerFriendly: params.stroller === "on" ? true : undefined,
      nursingRoom: params.nursing === "on" ? true : undefined,
      diaperChangingTable: params.diaper === "on" ? true : undefined,
      foodAllowed: params.food === "on" ? true : undefined,
      babyChair: params.babyChair === "on" ? true : undefined,
      elevator: params.elevator === "on" ? true : undefined
    },
    sort: sortParam(params),
    limit,
    offset: Math.min((page - 1) * limit, 1000)
  };
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
        origin: input.origin ?? null,
        search: {
          originalQuery: input.query ?? null,
          normalizedQuery: input.query ?? null,
          appliedPreferences: input.preferences ?? null,
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

function resultLimitParam(params: Record<string, string | string[] | undefined>) {
  const requested = Number(textParam(params.limit) || DEFAULT_RESULT_LIMIT);
  return RESULT_LIMIT_OPTIONS.includes(requested as (typeof RESULT_LIMIT_OPTIONS)[number]) ? requested : DEFAULT_RESULT_LIMIT;
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
    if (key === "page" || key === "offset") continue;
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
    if (key === "page" || key === "offset" || key === "category" || key === "categoryGroup") continue;
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
    href: `/places/${place.placeId}`,
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    placeId: place.placeId
  };
}

function resultKeywordChips(place: SearchItem) {
  const keywords = [
    categoryLabel(place.primaryCategory),
    indoorLabel(place.facilities.indoorType),
    ...place.tags.map(formatKeyword),
    ...positiveFacilityKeywords(place)
  ];

  return Array.from(new Set(keywords.filter(Boolean))).slice(0, 5);
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
