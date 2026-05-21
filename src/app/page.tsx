import Link from "next/link";
import { Database, MapPin, Search, Tag } from "lucide-react";

import { searchPlaces } from "@/lib/places";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.3322,
  lng: 127.4341,
  label: "대전역/원도심"
};

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
            <select name="category" defaultValue={textParam(params.category) || ""}>
              <option value="">전체</option>
              <option value="kids_cafe">키즈카페</option>
              <option value="indoor_playground">실내놀이터</option>
              <option value="toy_library">장난감도서관</option>
              <option value="library">도서관</option>
              <option value="museum">박물관/미술관</option>
              <option value="science_museum">과학관</option>
              <option value="experience_center">체험관</option>
              <option value="aquarium_zoo">동물/아쿠아리움</option>
              <option value="park">공원/놀이터</option>
              <option value="family_cafe">가족 카페</option>
              <option value="family_restaurant">놀이방/가족 식당</option>
              <option value="sports_venue">스포츠/야구장</option>
              <option value="shopping_mall">쇼핑/몰</option>
              <option value="rest_area">휴게소/이동 중 쉼터</option>
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
            <label className="check">
              <input name="nursing" type="checkbox" defaultChecked={params.nursing === "on"} />
              <span>수유실 선호</span>
            </label>
            <label className="check">
              <input name="diaper" type="checkbox" defaultChecked={params.diaper === "on"} />
              <span>기저귀 선호</span>
            </label>
            <label className="check">
              <input name="food" type="checkbox" defaultChecked={params.food === "on"} />
              <span>간식 공간 선호</span>
            </label>
            <label className="check">
              <input name="babyChair" type="checkbox" defaultChecked={params.babyChair === "on"} />
              <span>아기의자 선호</span>
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
          {result.items.map((place) => {
            const visibleReasons = place.reasons.slice(0, 8);
            const hiddenReasonCount = Math.max(0, place.reasons.length - visibleReasons.length);

            return (
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
                {place.description ? <p className="result-description">{place.description}</p> : null}
                <div className="facility-grid">
                  {facilitySignals(place).map((signal) => (
                    <span className={`facility-chip ${signal.tone}`} key={signal.label}>
                      {signal.label}: {signal.value}
                    </span>
                  ))}
                </div>
                <div className="visit-row">
                  {place.visit.averageStayMinutes ? <span>체류 {place.visit.averageStayMinutes}분</span> : null}
                  {place.visit.parentEffortLevel ? <span>부모 난이도 {place.visit.parentEffortLevel}/5</span> : null}
                  {place.notes.safety ? <span className="caution">안전 메모 있음</span> : null}
                </div>
                {place.notes.parent ? <p className="result-note">{place.notes.parent}</p> : null}
                {place.notes.safety ? <p className="result-note caution">{place.notes.safety}</p> : null}
                <div className="reason-grid">
                  {visibleReasons.map((reason) => (
                    <span className={reason.tone} key={reason.code} title={reason.code}>
                      {reason.labelKo}
                    </span>
                  ))}
                  {hiddenReasonCount > 0 ? <span className="more">+{hiddenReasonCount}</span> : null}
                </div>
              </article>
            );
          })}
          {result.items.length === 0 ? <div className="notice">아직 조건에 맞는 장소가 없습니다.</div> : null}
        </div>
      )}
    </div>
  );
}

function buildSearchInput(params: Record<string, string | string[] | undefined>): Partial<SearchPlacesInput> {
  const lat = Number(textParam(params.lat) || DEFAULT_ORIGIN.lat);
  const lng = Number(textParam(params.lng) || DEFAULT_ORIGIN.lng);
  const category = textParam(params.category);
  const ages = (textParam(params.ages) || "32,7,7")
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isFinite(age));

  return {
    origin: { lat, lng, label: DEFAULT_ORIGIN.label },
    visitContext: (textParam(params.visitContext) || undefined) as SearchPlacesInput["visitContext"],
    radiusKm: Number(textParam(params.radiusKm) || 80),
    query: textParam(params.query) || undefined,
    primaryCategories: category ? [category] : undefined,
    childAgeMonths: ages,
    preferences: {
      indoorTypes: params.indoor === "on" ? ["indoor", "mixed"] : undefined,
      parkingAvailable: params.parking === "on" ? true : undefined,
      strollerFriendly: params.stroller === "on" ? true : undefined,
      nursingRoom: params.nursing === "on" ? true : undefined,
      diaperChangingTable: params.diaper === "on" ? true : undefined,
      foodAllowed: params.food === "on" ? true : undefined,
      babyChair: params.babyChair === "on" ? true : undefined
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

type SearchItem = Awaited<ReturnType<typeof searchPlaces>>["items"][number];

function facilitySignals(place: SearchItem) {
  return [
    { label: "실내외", value: indoorLabel(place.facilities.indoorType), tone: toneForIndoor(place.facilities.indoorType) },
    { label: "주차", value: triStateLabel(place.facilities.parkingAvailable), tone: toneForTriState(place.facilities.parkingAvailable) },
    { label: "유모차", value: triStateLabel(place.facilities.strollerFriendly), tone: toneForTriState(place.facilities.strollerFriendly) },
    { label: "수유실", value: triStateLabel(place.facilities.nursingRoom), tone: toneForTriState(place.facilities.nursingRoom) },
    { label: "기저귀", value: triStateLabel(place.facilities.diaperChangingTable), tone: toneForTriState(place.facilities.diaperChangingTable) },
    { label: "유아화장실", value: triStateLabel(place.facilities.kidsToilet), tone: toneForTriState(place.facilities.kidsToilet) },
    { label: "아기의자", value: triStateLabel(place.facilities.babyChair), tone: toneForTriState(place.facilities.babyChair) },
    { label: "간식", value: triStateLabel(place.facilities.foodAllowed), tone: toneForTriState(place.facilities.foodAllowed) }
  ];
}

function indoorLabel(value: string) {
  const labels: Record<string, string> = {
    indoor: "실내",
    outdoor: "실외",
    mixed: "혼합",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function triStateLabel(value: string) {
  const labels: Record<string, string> = {
    yes: "있음",
    partial: "일부",
    no: "없음",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function toneForIndoor(value: string) {
  if (value === "indoor") return "positive";
  if (value === "mixed") return "partial";
  if (value === "outdoor") return "neutral";
  return "unknown";
}

function toneForTriState(value: string) {
  if (value === "yes") return "positive";
  if (value === "partial") return "partial";
  if (value === "no") return "negative";
  return "unknown";
}
