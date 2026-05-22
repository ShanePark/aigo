import Link from "next/link";
import { Database, MapPin, Search, Tag } from "lucide-react";

import { PlaceImage } from "@/app/place-image";
import { searchPlaces } from "@/lib/places";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

const DEFAULT_ORIGIN = {
  lat: 36.3322,
  lng: 127.4341,
  label: "대전역/원도심"
};
const DEFAULT_RESULT_LIMIT = 30;
const RESULT_LIMIT_OPTIONS = [30, 50, 100] as const;

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
            <span>표시 개수</span>
            <select name="limit" defaultValue={String(resultLimitParam(params))}>
              {RESULT_LIMIT_OPTIONS.map((limit) => (
                <option value={limit} key={limit}>
                  {limit}개
                </option>
              ))}
            </select>
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
            <label className="check">
              <input name="elevator" type="checkbox" defaultChecked={params.elevator === "on"} />
              <span>엘리베이터 선호</span>
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
          <p>{result.error ? "DB 연결 또는 마이그레이션 상태를 확인하세요." : resultCountLabel(result.meta)}</p>
        </div>
        <div className="code-pill">
          <Database size={14} aria-hidden="true" />
          <span>soft matching</span>
        </div>
      </section>

      {!result.error ? <SearchInterpretation search={result.meta.search} /> : null}

      {result.error ? (
        <div className="notice">{result.error}</div>
      ) : (
        <div className="results">
          {result.items.map((place) => {
            const visibleReasons = place.reasons.slice(0, 8);
            const hiddenReasonCount = Math.max(0, place.reasons.length - visibleReasons.length);
            const primaryImage = place.primaryImage;
            const playFeatureSignals = playFeatureChips(place.playFeatures).slice(0, 8);

            return (
              <article className="result-card" key={place.placeId}>
                <PlaceImage src={primaryImage?.url} alt={`${place.name} 대표 이미지`} variant="result" />
                <div className="result-main">
                  <div>
                    <p className="category" title={place.primaryCategory}>
                      {categoryLabel(place.primaryCategory)}
                    </p>
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
                {playFeatureSignals.length > 0 ? (
                  <div className="play-feature-grid" aria-label="놀이시설">
                    {playFeatureSignals.map((signal) => (
                      <span className={`play-feature-chip ${signal.tone}`} key={signal.label}>
                        {signal.label}: {signal.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="visit-row">
                  <span>v{place.version}</span>
                  <span>신뢰도 {confidenceLabel(place.dataConfidence)}</span>
                  {primaryImage ? <span>이미지 {imageTierLabel(primaryImage.displayTier)}</span> : null}
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
      babyChair: params.babyChair === "on" ? true : undefined,
      elevator: params.elevator === "on" ? true : undefined
    },
    limit: resultLimitParam(params)
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

type SearchItem = Awaited<ReturnType<typeof searchPlaces>>["items"][number];
type SearchMeta = Awaited<ReturnType<typeof searchPlaces>>["meta"]["search"];
type SearchResultMeta = Awaited<ReturnType<typeof searchPlaces>>["meta"];

function resultCountLabel(meta: SearchResultMeta) {
  if (meta.total <= meta.count) {
    return `${meta.total}개 후보`;
  }
  return `${meta.total}개 후보 중 상위 ${meta.count}개 표시`;
}

function SearchInterpretation({ search }: { search: SearchMeta }) {
  const preferenceLabels = preferenceChips(search.appliedPreferences);

  if (!search.originalQuery && !search.normalizedQuery && !search.visitContext && preferenceLabels.length === 0) {
    return null;
  }

  return (
    <section className="search-interpretation" aria-label="검색 해석">
      <div>
        <strong>검색 해석</strong>
        <span>{search.normalized ? "자동 정규화" : "입력 조건 그대로"}</span>
      </div>
      <div className="interpretation-tags">
        {search.originalQuery ? <span>입력: {search.originalQuery}</span> : null}
        {search.normalizedQuery ? <span>키워드: {search.normalizedQuery}</span> : null}
        {search.visitContext ? <span>상황: {visitContextLabel(search.visitContext)}</span> : null}
        {preferenceLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}

function preferenceChips(preferences: SearchMeta["appliedPreferences"]) {
  if (!preferences || typeof preferences !== "object") return [];
  const chips: string[] = [];
  const typed = preferences as NonNullable<SearchPlacesInput["preferences"]>;

  if (typed.indoorTypes?.includes("indoor")) chips.push("실내 우선");
  if (typed.parkingAvailable) chips.push("주차");
  if (typed.strollerFriendly) chips.push("유모차");
  if (typed.nursingRoom) chips.push("수유실");
  if (typed.diaperChangingTable) chips.push("기저귀");
  if (typed.elevator) chips.push("엘리베이터");
  if (typed.babyChair) chips.push("아기의자");
  if (typed.foodAllowed) chips.push("간식 공간");

  return chips;
}

function visitContextLabel(value: NonNullable<SearchPlacesInput["visitContext"]>) {
  const labels: Record<NonNullable<SearchPlacesInput["visitContext"]>, string> = {
    afterDaycare: "하원 후",
    nearbyNow: "당장 근처",
    rainyDay: "비 오는 날",
    weekendHalfDay: "주말 반나절",
    dayTrip: "당일치기"
  };
  return labels[value] ?? value;
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
    rest_area: "휴게소/쉼터"
  };
  return labels[value] ?? value;
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    official_verified: "공식 확인",
    operator_curated: "운영자 확인",
    agent_collected: "에이전트 수집",
    user_reported: "사용자 제보",
    needs_check: "확인 필요",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function imageTierLabel(value: string) {
  const labels: Record<string, string> = {
    official: "공식",
    public_agency: "공공",
    public_listing: "목록",
    rights_unclear: "검토",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function facilitySignals(place: SearchItem) {
  return [
    { label: "실내외", value: indoorLabel(place.facilities.indoorType), tone: toneForIndoor(place.facilities.indoorType) },
    { label: "주차", value: triStateLabel(place.facilities.parkingAvailable), tone: toneForTriState(place.facilities.parkingAvailable) },
    { label: "유모차", value: triStateLabel(place.facilities.strollerFriendly), tone: toneForTriState(place.facilities.strollerFriendly) },
    { label: "수유실", value: triStateLabel(place.facilities.nursingRoom), tone: toneForTriState(place.facilities.nursingRoom) },
    { label: "기저귀", value: triStateLabel(place.facilities.diaperChangingTable), tone: toneForTriState(place.facilities.diaperChangingTable) },
    { label: "유아화장실", value: triStateLabel(place.facilities.kidsToilet), tone: toneForTriState(place.facilities.kidsToilet) },
    { label: "엘리베이터", value: triStateLabel(place.facilities.elevator), tone: toneForTriState(place.facilities.elevator) },
    { label: "아기의자", value: triStateLabel(place.facilities.babyChair), tone: toneForTriState(place.facilities.babyChair) },
    { label: "간식", value: triStateLabel(place.facilities.foodAllowed), tone: toneForTriState(place.facilities.foodAllowed) }
  ];
}

function playFeatureChips(playFeatures: Record<string, unknown>) {
  return playFeatureEntries(playFeatures).map(([key, value]) => ({
    label: playFeatureLabel(key),
    value: playFeatureValueLabel(value),
    tone: playFeatureTone(value)
  }));
}

function playFeatureEntries(playFeatures: Record<string, unknown>) {
  const preferredOrder = [
    "slide",
    "swing",
    "babySwing",
    "waterPlayground",
    "sandPlay",
    "climbing",
    "seesaw",
    "trampoline",
    "rideOnToys",
    "playHouse",
    "openLawn",
    "shade",
    "fenced",
    "rubberSurface",
    "strollerPath",
    "toiletNearby"
  ];
  const entries = Object.entries(playFeatures ?? {}).filter(([key, value]) => key !== "evidence" && key !== "notes" && value !== undefined && value !== null);
  const order = new Map(preferredOrder.map((key, index) => [key, index]));
  return entries.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0]));
}

function playFeatureLabel(key: string) {
  const labels: Record<string, string> = {
    slide: "미끄럼틀",
    swing: "그네",
    babySwing: "영아그네",
    waterPlayground: "물놀이터",
    sandPlay: "모래놀이",
    climbing: "클라이밍",
    seesaw: "시소",
    trampoline: "트램폴린",
    rideOnToys: "승용완구",
    playHouse: "놀이집",
    openLawn: "잔디",
    shade: "그늘",
    fenced: "울타리",
    rubberSurface: "탄성포장",
    strollerPath: "유모차길",
    toiletNearby: "화장실 인근"
  };
  return labels[key] ?? key;
}

function playFeatureValueLabel(value: unknown) {
  if (typeof value === "string") return triStateLabel(value);
  if (typeof value === "boolean") return value ? "있음" : "없음";
  return "기록";
}

function playFeatureTone(value: unknown) {
  if (value === "yes" || value === true) return "positive";
  if (value === "partial") return "partial";
  if (value === "no" || value === false) return "negative";
  return "unknown";
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
