import { Clock, History, Home, MapPin, MousePointerClick, RotateCcw } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { PlaceImage } from "@/app/place-image";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { listRecentPlaces, type RecentPlaceItem } from "@/lib/user-place-views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RecentPlacesPage() {
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <div className="page visits-page">
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">최근 본 장소</p>
            <h1>로그인 후 최근 확인한 장소를 볼 수 있어요</h1>
            <p>장소 상세를 열면 자동으로 기록되고, 나중에 다시 이어서 살펴볼 수 있습니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action" href="/">
              <Home size={15} aria-hidden="true" />
              AiGo 홈
            </Link>
            <Link className="empty-state-action is-primary" href="/login?next=/recent-places">
              <History size={15} aria-hidden="true" />
              로그인
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { items } = await listRecentPlaces(user.id, 30);

  return (
    <div className="page visits-page">
      <header className="visits-hero">
        <div className="visits-hero-copy">
          <p className="category">최근 본 장소</p>
          <h1>방금 살펴본 장소들</h1>
          <p className="lede">장소 상세에 들어간 기록을 최신순으로 모아, 비교하다 놓친 후보를 다시 꺼내 봅니다.</p>
        </div>
        <div className="visits-hero-side">
          <div className="visits-summary" aria-label="최근 본 장소 요약">
            <span>
              <History size={15} aria-hidden="true" />
              {items.length}곳
            </span>
            <span>
              <Clock size={15} aria-hidden="true" />
              최신순
            </span>
          </div>
          <RecentPlacesActions />
        </div>
      </header>

      {items.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">아직 기록 없음</p>
            <h2>장소 상세를 열면 여기에 쌓여요</h2>
            <p>검색 결과에서 궁금한 장소를 눌러 보면 최근 본 장소 목록에 자동으로 저장됩니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action is-primary" href="/">
              <MapPin size={15} aria-hidden="true" />
              장소 찾기
            </Link>
          </div>
        </section>
      ) : (
        <section className="recent-place-list" aria-label="최근 본 장소 목록">
          {items.map((item) => (
            <RecentPlaceCard item={item} key={item.placeId} />
          ))}
        </section>
      )}
    </div>
  );
}

function RecentPlaceCard({ item }: { item: RecentPlaceItem }) {
  return (
    <Link className="recent-place-card" href={placeHref(item.placeId)} aria-label={`${item.placeName} 상세 보기`}>
      <PlaceImage category={item.primaryCategory} src={item.imageUrl} alt={`${item.placeName} 대표 이미지`} variant="result" />
      <div className="recent-place-card-body">
        <div className="visit-log-card-topline">
          <span className="category-pill" title={item.primaryCategory}>
            {categoryLabel(item.primaryCategory)}
          </span>
          <span className="trust-badge neutral">
            <MousePointerClick size={13} aria-hidden="true" />
            {item.viewCount}회 열람
          </span>
        </div>
        <h2>{item.placeName}</h2>
        <p className="visit-log-review">
          <MapPin size={14} aria-hidden="true" />
          <span>{regionLabel(item)}</span>
        </p>
      </div>
      <div className="visit-log-card-stats">
        <span>
          <Clock size={13} aria-hidden="true" />
          {formatViewedAt(item.lastViewedAt)}
        </span>
      </div>
    </Link>
  );
}

function RecentPlacesActions() {
  return (
    <nav className="visits-actions" aria-label="최근 본 장소 이동">
      <Link className="visits-action" href="/">
        <Home size={15} aria-hidden="true" />
        AiGo 홈
      </Link>
      <Link className="visits-action is-primary" href="/">
        <RotateCcw size={15} aria-hidden="true" />
        다시 찾기
      </Link>
    </nav>
  );
}

function placeHref(placeId: string): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent("/recent-places")}` as Route;
}

function regionLabel(item: RecentPlaceItem) {
  return [item.regionSido, item.regionSigungu].filter(Boolean).join(" ") || "지역 정보 없음";
}

function formatViewedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
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
