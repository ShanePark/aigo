import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink, History, MapPin, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { PlaceImage } from "@/app/place-image";
import { getPlaceDetail } from "@/lib/places";

type PlaceDetailProps = {
  params: Promise<{
    placeId: string;
  }>;
};

export default async function PlaceDetailPage({ params }: PlaceDetailProps) {
  const { placeId } = await params;
  const place = await loadPlace(placeId);
  const displaySources = uniqueDisplaySources(place.sources);
  const heroImage = place.primaryImage;

  return (
    <div className="page detail-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} aria-hidden="true" />
        검색으로 돌아가기
      </Link>

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

function normalizeSourceValue(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "").toLowerCase() ?? "";
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
