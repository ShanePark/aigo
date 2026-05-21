import Link from "next/link";
import { Database, MapPin, Search, Tag } from "lucide-react";

import { searchPlaces } from "@/lib/places";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const input = searchPlacesSchema.parse(buildSearchInput(params));
  const result = await safeSearch(input);

  return (
    <div className="page">
      <section className="search-shell">
        <div>
          <p className="eyebrow">Agent-friendly place search</p>
          <h1>아이와 갈 장소를 조건으로 비교하기</h1>
          <p className="lede">
            권장 나이와 편의시설은 후보를 제외하지 않고 점수와 reason code에 반영합니다.
          </p>
        </div>

        <form className="search-form" action="/">
          <label>
            <span>키워드</span>
            <input name="query" defaultValue={textParam(params.query)} placeholder="실내, 과학, 물놀이..." />
          </label>
          <label>
            <span>주카테고리</span>
            <input name="category" defaultValue={textParam(params.category)} placeholder="kids_cafe, museum..." />
          </label>
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
            <input name="lat" type="number" step="0.000001" defaultValue={textParam(params.lat) || "36.3504"} />
          </label>
          <label>
            <span>경도</span>
            <input name="lng" type="number" step="0.000001" defaultValue={textParam(params.lng) || "127.3845"} />
          </label>
          <div className="checks">
            <label className="check">
              <input name="indoor" type="checkbox" defaultChecked={params.indoor === "on"} />
              <span>실내 선호</span>
            </label>
            <label className="check">
              <input name="parking" type="checkbox" defaultChecked={params.parking === "on"} />
              <span>주차 선호</span>
            </label>
            <label className="check">
              <input name="stroller" type="checkbox" defaultChecked={params.stroller === "on"} />
              <span>유모차 선호</span>
            </label>
          </div>
          <button type="submit" className="primary-button">
            <Search size={16} aria-hidden="true" />
            검색
          </button>
        </form>
      </section>

      <section className="result-header">
        <div>
          <h2>검색 결과</h2>
          <p>{result.error ? "DB 연결 또는 마이그레이션 상태를 확인하세요." : `${result.meta.total}개 후보`}</p>
        </div>
        <div className="code-pill">
          <Database size={14} aria-hidden="true" />
          <span>soft matching</span>
        </div>
      </section>

      {result.error ? (
        <div className="notice">{result.error}</div>
      ) : (
        <div className="results">
          {result.items.map((place) => (
            <article className="result-card" key={place.placeId}>
              <div className="result-main">
                <div>
                  <p className="category">{place.primaryCategory}</p>
                  <h3>
                    <Link href={`/places/${place.placeId}`}>{place.name}</Link>
                  </h3>
                </div>
                <div className="score">{place.score}</div>
              </div>
              <div className="meta-row">
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {place.distanceKm === null ? "거리 미계산" : `${place.distanceKm.toFixed(1)}km`}
                </span>
                <span>
                  <Tag size={14} aria-hidden="true" />
                  {place.tags.slice(0, 4).join(", ") || "태그 없음"}
                </span>
              </div>
              <div className="reason-grid">
                {place.reasonCodes.slice(0, 8).map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
            </article>
          ))}
          {result.items.length === 0 ? <div className="notice">아직 조건에 맞는 장소가 없습니다.</div> : null}
        </div>
      )}
    </div>
  );
}

function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const lat = Number(textParam(params.lat) || 36.3504);
  const lng = Number(textParam(params.lng) || 127.3845);
  const category = textParam(params.category);
  const ages = (textParam(params.ages) || "32,7,7")
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isFinite(age));

  return {
    origin: { lat, lng, label: "대전" },
    radiusKm: Number(textParam(params.radiusKm) || 80),
    query: textParam(params.query) || undefined,
    primaryCategories: category ? [category] : undefined,
    childAgeMonths: ages,
    preferences: {
      indoorTypes: params.indoor === "on" ? ["indoor", "mixed"] : undefined,
      parkingAvailable: params.parking === "on" ? true : undefined,
      strollerFriendly: params.stroller === "on" ? true : undefined
    },
    limit: 30
  };
}

async function safeSearch(input: SearchPlacesInput) {
  try {
    return { ...(await searchPlaces(input)), error: undefined as string | undefined };
  } catch (error) {
    return {
      items: [],
      meta: { count: 0, total: 0, limit: input.limit, offset: input.offset, origin: input.origin ?? null },
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다."
    };
  }
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
