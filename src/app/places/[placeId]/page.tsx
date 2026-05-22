import { Clock, ExternalLink, History, MapPin, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PlaceImage } from "@/app/place-image";
import { BackToSearchLink } from "@/app/places/back-to-search-link";
import { PlaceDetailMap } from "@/app/places/place-detail-map";
import { buildPlaceInfoLinks } from "@/lib/place-links";
import { getPlaceDetail } from "@/lib/places";

type PlaceDetailProps = {
  params: Promise<{
    placeId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function searchBackHref(value: string | string[] | undefined): Route {
  const candidate = textParam(value);
  if (!candidate || candidate.startsWith("//") || !candidate.startsWith("/")) return "/";

  try {
    const url = new URL(candidate, "https://aigo.local");
    if (url.origin !== "https://aigo.local" || url.pathname !== "/") return "/";
    return `${url.pathname}${url.search}${url.hash}` as Route;
  } catch {
    return "/";
  }
}

function relatedPlaceHref(placeId: string, backHref: Route): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent(backHref)}` as Route;
}

export default async function PlaceDetailPage({ params, searchParams }: PlaceDetailProps) {
  const { placeId } = await params;
  const query = await searchParams;
  const place = await loadPlace(placeId);
  const displaySources = uniqueDisplaySources(place.sources);
  const infoLinks = buildPlaceInfoLinks(place);
  const reviewLinks = buildReviewLinks(place);
  const heroImage = place.primaryImage;
  const galleryImages = place.images;
  const backHref = searchBackHref(query.returnTo);

  return (
    <div className="page detail-page">
      <BackToSearchLink href={backHref} />

      <section className="detail-head">
        <div>
          <p className="category" title={place.primaryCategory}>
            {categoryLabel(place.primaryCategory)}
          </p>
          <h1>{place.name}</h1>
          <p className="lede">{place.description ?? "설명이 아직 등록되지 않았습니다."}</p>
        </div>
        <div className="score version-box">
          v{place.version}
        </div>
      </section>

      <PlaceImage src={heroImage?.url} alt={`${place.name} 대표 이미지`} variant="detail" />
      {heroImage?.sourceUrl ? (
        <p className="image-credit">
          이미지 {imageTierLabel(heroImage.displayTier)} 출처:{" "}
          <a href={heroImage.sourceUrl} target="_blank" rel="noreferrer">
            {heroImage.sourceTitle ?? heroImage.creditText}
          </a>
        </p>
      ) : null}

      <PlaceDetailMap address={place.address ?? place.roadAddress ?? undefined} category={place.primaryCategory} lat={place.lat} lng={place.lng} name={place.name} />

      {place.relatedPlaces.length > 0 ? (
        <section className="info-block full">
          <h2>관련 장소</h2>
          <div className="related-place-grid">
            {place.relatedPlaces.map((relatedPlace) => (
              <Link className="related-place-card" href={relatedPlaceHref(relatedPlace.placeId, backHref)} key={relatedPlace.relationId}>
                <span>{relationTypeLabel(relatedPlace.relationType)}</span>
                <strong>{relatedPlace.name}</strong>
                <small>
                  {categoryLabel(relatedPlace.primaryCategory)}
                  {relatedPlace.distanceMeters !== null ? ` · ${metersLabel(relatedPlace.distanceMeters)}` : null}
                </small>
                {relatedPlace.note ? <p>{relatedPlace.note}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {galleryImages.length > 0 ? (
        <section className="image-audit-section">
          <h2>이미지 검수</h2>
          <div className="image-audit-grid">
            {galleryImages.map((image) => (
              <article className="image-audit-card" key={image.id}>
                <PlaceImage src={image.url} alt={image.altText ?? `${place.name} 이미지`} variant="result" />
                <div>
                  <div className="visit-row">
                    {image.isPrimary ? <span>대표</span> : null}
                    <span>이미지 {imageTierLabel(image.displayTier)}</span>
                    <span>{imageReviewLabel(image.reviewStatus)}</span>
                  </div>
                  {image.description ? <p>{image.description}</p> : <p className="muted">아직 눈으로 검수한 설명이 없습니다.</p>}
                  {image.visualFeatures.length > 0 ? (
                    <div className="reason-grid">
                      {image.visualFeatures.slice(0, 10).map((feature) => (
                        <span key={feature}>{imageFeatureLabel(feature)}</span>
                      ))}
                    </div>
                  ) : null}
                  {image.sourceUrl ? (
                    <a className="image-source-link" href={image.sourceUrl} target="_blank" rel="noreferrer">
                      {image.sourceTitle ?? image.creditText}
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-grid">
        <div className="info-block">
          <h2>기본 정보</h2>
          <dl>
            <dt>주소</dt>
            <dd>{place.address ?? place.roadAddress ?? "미등록"}</dd>
            <dt>좌표</dt>
            <dd>
              <MapPin size={14} aria-hidden="true" />
              {place.lat}, {place.lng}
            </dd>
            <dt>신뢰도</dt>
            <dd>{confidenceLabel(place.dataConfidence)}</dd>
            <dt>장소 평가</dt>
            <dd>{tenPointScoreLabel(place.scoring.placeScore)}</dd>
            <dt>태그</dt>
            <dd>{place.tags.join(", ") || "없음"}</dd>
          </dl>
        </div>

        <div className="info-block">
          <h2>아이 동반 신호</h2>
          <dl>
            <dt>권장 월령</dt>
            <dd>
              {place.recommendedAgeMonths.min ?? "?"} - {place.recommendedAgeMonths.max ?? "?"}
            </dd>
            <dt>실내외</dt>
            <dd>{indoorLabel(place.facilities.indoorType)}</dd>
            <dt>유모차</dt>
            <dd>{triStateLabel(place.facilities.strollerFriendly)}</dd>
            <dt>주차</dt>
            <dd>{triStateLabel(place.facilities.parkingAvailable)}</dd>
            <dt>수유실</dt>
            <dd>{triStateLabel(place.facilities.nursingRoom)}</dd>
            <dt>기저귀 교환대</dt>
            <dd>{triStateLabel(place.facilities.diaperChangingTable)}</dd>
            <dt>어린이 화장실</dt>
            <dd>{triStateLabel(place.facilities.kidsToilet)}</dd>
            <dt>엘리베이터</dt>
            <dd>{triStateLabel(place.facilities.elevator)}</dd>
            <dt>아기의자</dt>
            <dd>{triStateLabel(place.facilities.babyChair)}</dd>
            <dt>간식/음식</dt>
            <dd>{triStateLabel(place.facilities.foodAllowed)}</dd>
          </dl>
        </div>
      </section>

      <section className="info-block full">
        <h2>
          <Clock size={18} aria-hidden="true" />
          방문 판단
        </h2>
        <div className="detail-signal-grid">
          <span>체류 {minutesLabel(place.visit.averageStayMinutes)}</span>
          <span>부모 피로도 {scoreLabel(place.visit.parentEffortLevel)}</span>
          <span>아이 몰입도 {scoreLabel(place.visit.childEngagementLevel)}</span>
          <span>비 오는 날 {scoreLabel(place.visit.rainyDayScore)}</span>
          <span>더운 날 {scoreLabel(place.visit.hotDayScore)}</span>
          <span>추운 날 {scoreLabel(place.visit.coldDayScore)}</span>
        </div>
      </section>

      {playFeatureEntries(place.playFeatures).length > 0 ? (
        <section className="info-block full">
          <h2>놀이시설</h2>
          <div className="play-feature-grid detail-play-feature-grid">
            {playFeatureEntries(place.playFeatures).map(([key, value]) => (
              <span className={`play-feature-chip ${playFeatureTone(value)}`} key={key}>
                {playFeatureLabel(key)}: {playFeatureValueLabel(value)}
              </span>
            ))}
          </div>
          {typeof place.playFeatures.notes === "string" && place.playFeatures.notes.trim().length > 0 ? (
            <p className="play-feature-note">{place.playFeatures.notes}</p>
          ) : null}
        </section>
      ) : null}

      {place.notes.safety || place.notes.parent ? (
        <section className="info-block full">
          <h2>
            <ShieldCheck size={18} aria-hidden="true" />
            메모
          </h2>
          <div className="note-list">
            {place.notes.safety ? (
              <div>
                <strong>안전</strong>
                <p>{place.notes.safety}</p>
              </div>
            ) : null}
            {place.notes.parent ? (
              <div>
                <strong>부모 관점</strong>
                <p>{place.notes.parent}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {infoLinks.length > 0 ? (
        <section className="info-block full">
          <h2>
            <ExternalLink size={18} aria-hidden="true" />
            정보 확인하기
          </h2>
          <div className="source-list">
            {infoLinks.map((infoLink) => (
              <a className="source-row" href={infoLink.url} target="_blank" rel="noreferrer" key={infoLink.key}>
                <span>{infoLink.provider}</span>
                <small>
                  <strong>{infoLink.label}</strong>
                  {infoLink.note ? ` - ${infoLink.note}` : null}
                </small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {reviewLinks.length > 0 ? (
        <section className="info-block full">
          <h2>
            <MessageSquareText size={18} aria-hidden="true" />
            후기 살펴보기
          </h2>
          <div className="source-list">
            {reviewLinks.map((reviewLink) => (
              <a className="source-row review-link-row" href={reviewLink.url} target="_blank" rel="noreferrer" key={reviewLink.key}>
                <span>{reviewLink.provider}</span>
                <small>
                  <strong>{reviewLink.label}</strong>
                  {reviewLink.note ? ` - ${reviewLink.note}` : null}
                </small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="info-block full">
        <h2>출처</h2>
        <div className="source-list">
          {displaySources.map((source) =>
            source.url ? (
              <a key={source.key} className="source-row" href={source.url} target="_blank" rel="noreferrer">
                <span>
                  {source.title ?? source.sourceType}
                  {source.count > 1 ? <em> {source.count}회</em> : null}
                </span>
                <small>{source.summary ?? source.externalId ?? "요약 없음"}</small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <div key={source.key} className="source-row source-row-static">
                <span>
                  {source.title ?? source.sourceType}
                  {source.count > 1 ? <em> {source.count}회</em> : null}
                </span>
                <small>{source.summary ?? "요약 없음"}</small>
                <small>{source.externalId ?? "외부 ID 없음"}</small>
              </div>
            )
          )}
          {place.sources.length === 0 ? <p>등록된 출처가 없습니다.</p> : null}
        </div>
      </section>

      <section className="info-block full">
        <h2>
          <History size={18} aria-hidden="true" />
          변경 이력
        </h2>
        <div className="version-list">
          {place.versions.map((version) => (
            <div className="version-row" key={version.id}>
              <span>v{version.versionNumber}</span>
              <strong>{version.action}</strong>
              <small>{version.changeSummary ?? "변경 요약 없음"}</small>
              <time>{new Date(version.createdAt).toLocaleString("ko-KR")}</time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function loadPlace(placeId: string) {
  try {
    return await getPlaceDetail(placeId);
  } catch {
    notFound();
  }
}

type PlaceDetail = Awaited<ReturnType<typeof getPlaceDetail>>;
type Source = PlaceDetail["sources"][number];

type ReviewLink = {
  key: string;
  label: string;
  note?: string;
  provider: string;
  url: string;
};

function uniqueDisplaySources(sources: Source[]) {
  const grouped = new Map<string, Source & { key: string; count: number }>();

  for (const source of sources) {
    const key = [normalizeSourceValue(source.url), normalizeSourceValue(source.externalId), normalizeSourceValue(source.title)].join("|");
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.summary && source.summary) existing.summary = source.summary;
      continue;
    }
    grouped.set(key, { ...source, key, count: 1 });
  }

  return Array.from(grouped.values());
}

function buildReviewLinks(place: PlaceDetail) {
  const links = [...reviewLinksFromExternalRefs(place.externalRefs), ...reviewLinksFromSources(place.sources)];
  const deduped = new Map<string, ReviewLink>();

  for (const link of links) {
    const key = normalizeSourceValue(link.url);
    if (!key || deduped.has(key)) continue;
    deduped.set(key, { ...link, key });
  }

  return Array.from(deduped.values());
}

function reviewLinksFromExternalRefs(externalRefs: PlaceDetail["externalRefs"]) {
  if (!isRecord(externalRefs) || !Array.isArray(externalRefs.reviewLinks)) return [];

  return externalRefs.reviewLinks.flatMap((item, index): ReviewLink[] => {
    if (typeof item === "string" && isHttpUrl(item)) {
      return [
        {
          key: item,
          label: reviewProviderLabel(item),
          provider: reviewProviderLabel(item),
          url: item
        }
      ];
    }

    if (!isRecord(item) || typeof item.url !== "string" || !isHttpUrl(item.url)) return [];
    const provider = stringValue(item.provider) ?? reviewProviderLabel(item.url);
    const label = stringValue(item.label) ?? stringValue(item.title) ?? provider;
    const note = stringValue(item.note) ?? stringValue(item.summary);

    return [{ key: `${item.url}-${index}`, label, note, provider, url: item.url }];
  });
}

function reviewLinksFromSources(sources: Source[]) {
  return sources.flatMap((source): ReviewLink[] => {
    if (!source.url || !isReviewSource(source)) return [];
    const provider = source.title ?? reviewProviderLabel(source.url);

    return [
      {
        key: source.url,
        label: provider,
        note: source.summary ?? undefined,
        provider: reviewProviderLabel(source.url),
        url: source.url
      }
    ];
  });
}

function isReviewSource(source: Source) {
  const searchable = [source.sourceType, source.title, source.summary, source.url].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
  return /review|리뷰|후기|blog|블로그|listing|place|naver|kakao|google|tripadvisor|booking|agoda|yanolja|yeogi/.test(searchable);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function reviewProviderLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("blog.naver")) return "네이버 블로그";
    if (hostname.includes("naver")) return "네이버";
    if (hostname.includes("kakao")) return "카카오";
    if (hostname.includes("google")) return "Google";
    if (hostname.includes("tripadvisor")) return "Tripadvisor";
    if (hostname.includes("booking")) return "Booking";
    if (hostname.includes("agoda")) return "Agoda";
    if (hostname.includes("yanolja")) return "야놀자";
    if (hostname.includes("yeogi")) return "여기어때";
    return hostname.replace(/^www\./, "");
  } catch {
    return "후기 링크";
  }
}

function normalizeSourceValue(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "").toLowerCase() ?? "";
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function minutesLabel(value: number | null) {
  return value === null ? "미확인" : `${value}분`;
}

function scoreLabel(value: number | null) {
  return value === null ? "미확인" : `${value}/5`;
}

function tenPointScoreLabel(value: number | null) {
  return value === null ? "미평가" : `${value}/10`;
}

function metersLabel(value: number) {
  return value < 1000 ? `${value}m` : `${(value / 1000).toFixed(1)}km`;
}

function relationTypeLabel(value: string) {
  const labels: Record<string, string> = {
    nearby: "가까운 곳",
    same_building: "같은 건물",
    same_site: "같은 시설",
    parent_child: "부속 시설",
    route_pair: "함께 보기",
    itinerary_cluster: "일정 묶음"
  };
  return labels[value] ?? "관련 장소";
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

function imageReviewLabel(value: string) {
  const labels: Record<string, string> = {
    pending_review: "검수 대기",
    approved: "검수 완료",
    needs_review: "재검수",
    rejected: "제외"
  };
  return labels[value] ?? value;
}

function imageFeatureLabel(value: string) {
  const labels: Record<string, string> = {
    slide: "미끄럼틀",
    swing: "그네",
    sand_play: "모래놀이",
    ball_pool: "볼풀",
    trampoline: "트램펄린",
    climbing: "클라이밍",
    water_play: "물놀이",
    fountain: "분수",
    stroller_path: "유모차 동선",
    shade: "그늘",
    books: "책/그림책",
    playroom: "놀이방",
    baby_chair: "아기의자"
  };
  return labels[value] ?? value;
}
