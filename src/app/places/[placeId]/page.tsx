import Link from "next/link";
import { ArrowLeft, ExternalLink, History, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { getPlaceDetail } from "@/lib/places";

type PlaceDetailProps = {
  params: Promise<{
    placeId: string;
  }>;
};

export default async function PlaceDetailPage({ params }: PlaceDetailProps) {
  const { placeId } = await params;
  const place = await loadPlace(placeId);

  return (
    <div className="page detail-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} aria-hidden="true" />
        검색으로 돌아가기
      </Link>

      <section className="detail-head">
        <div>
          <p className="category">{place.primaryCategory}</p>
          <h1>{place.name}</h1>
          <p className="lede">{place.description ?? "설명이 아직 등록되지 않았습니다."}</p>
        </div>
        <div className="score version-box">
          v{place.version}
        </div>
      </section>

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
            <dd>{place.dataConfidence}</dd>
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
            <dd>{place.facilities.indoorType}</dd>
            <dt>유모차</dt>
            <dd>{place.facilities.strollerFriendly}</dd>
            <dt>주차</dt>
            <dd>{place.facilities.parkingAvailable}</dd>
            <dt>수유실</dt>
            <dd>{place.facilities.nursingRoom}</dd>
            <dt>기저귀 교환대</dt>
            <dd>{place.facilities.diaperChangingTable}</dd>
          </dl>
        </div>
      </section>

      <section className="info-block full">
        <h2>출처</h2>
        <div className="source-list">
          {place.sources.map((source) => (
            <a key={source.id} className="source-row" href={source.url ?? "#"} target="_blank" rel="noreferrer">
              <span>{source.title ?? source.sourceType}</span>
              <small>{source.summary ?? source.externalId ?? "요약 없음"}</small>
              {source.url ? <ExternalLink size={14} aria-hidden="true" /> : null}
            </a>
          ))}
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

