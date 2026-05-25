import { Bookmark, Heart, Home, MapPin } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { PlaceImage } from "@/app/place-image";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { listSavedPlaces, savedPlacesFilterSchema, type SavedPlaceItem, type SavedPlacesFilter } from "@/lib/user-place-saves";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedPlacesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FILTERS: Array<{ href: Route; label: string; value: SavedPlacesFilter }> = [
  { href: "/saved-places", label: "전체", value: "all" },
  { href: "/saved-places?filter=wantToGo", label: "가고 싶음", value: "wantToGo" },
  { href: "/saved-places?filter=hearted", label: "하트", value: "hearted" }
];

export default async function SavedPlacesPage({ searchParams }: SavedPlacesPageProps) {
  const params = await searchParams;
  const filter = savedPlacesFilter(params.filter);
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <div className="page visits-page">
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <Bookmark size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">저장한 장소</p>
            <h1>로그인 후 저장한 장소를 볼 수 있어요</h1>
            <p>장소 카드나 상세에서 가고 싶은 곳과 하트 장소를 따로 저장해두고 다시 비교할 수 있습니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action" href="/">
              <Home size={15} aria-hidden="true" />
              AiGo 홈
            </Link>
            <Link className="empty-state-action is-primary" href="/login?next=/saved-places">
              <Bookmark size={15} aria-hidden="true" />
              로그인
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { items } = await listSavedPlaces(user.id, filter);
  const summary = summarizeSavedPlaces(items);

  return (
    <div className="page visits-page">
      <header className="visits-hero">
        <div className="visits-hero-copy">
          <p className="category">저장한 장소</p>
          <h1>다시 보고 싶은 후보들</h1>
          <p className="lede">가고 싶은 장소와 마음에 든 장소를 나눠 저장하고, 다음 외출 후보를 빠르게 다시 꺼내 봅니다.</p>
        </div>
        <div className="visits-hero-side">
          <div className="visits-summary" aria-label="저장한 장소 요약">
            <span className="saved-place-summary-pill is-want-to-go">
              <Bookmark size={15} aria-hidden="true" />
              가고 싶음 {summary.wantToGoCount}
            </span>
            <span className="saved-place-summary-pill is-hearted">
              <Heart size={15} aria-hidden="true" fill="currentColor" />
              하트 {summary.heartedCount}
            </span>
          </div>
          <SavedPlaceFilters activeFilter={filter} />
        </div>
      </header>

      {items.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <Bookmark size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">저장한 장소 없음</p>
            <h2>{emptyTitle(filter)}</h2>
            <p>검색 결과나 장소 상세에서 저장 버튼을 누르면 이 목록에 모입니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action is-primary" href="/">
              <MapPin size={15} aria-hidden="true" />
              장소 찾기
            </Link>
          </div>
        </section>
      ) : (
        <section className="recent-place-list" aria-label="저장한 장소 목록">
          {items.map((item) => (
            <SavedPlaceCard item={item} key={item.placeId} />
          ))}
        </section>
      )}
    </div>
  );
}

function SavedPlaceFilters({ activeFilter }: { activeFilter: SavedPlacesFilter }) {
  return (
    <nav className="limit-control saved-place-filters" aria-label="저장한 장소 필터">
      {FILTERS.map((filter) => (
        <Link className={`limit-option ${activeFilter === filter.value ? "is-active" : ""}`} href={filter.href} key={filter.value}>
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

function SavedPlaceCard({ item }: { item: SavedPlaceItem }) {
  return (
    <Link className="recent-place-card" href={placeHref(item.placeId)} aria-label={`${item.placeName} 상세 보기`}>
      <PlaceImage category={item.primaryCategory} src={item.imageUrl} alt={`${item.placeName} 대표 이미지`} variant="result" />
      <div className="recent-place-card-body">
        <div className="visit-log-card-topline">
          <span className="category-pill" title={item.primaryCategory}>
            {categoryLabel(item.primaryCategory)}
          </span>
          {item.wantToGo ? (
            <span className="trust-badge positive">
              <Bookmark size={13} aria-hidden="true" />
              가고 싶음
            </span>
          ) : null}
          {item.hearted ? (
            <span className="trust-badge saved-place-badge is-hearted">
              <Heart size={13} aria-hidden="true" fill="currentColor" />
              하트
            </span>
          ) : null}
        </div>
        <h2>{item.placeName}</h2>
        <p className="visit-log-review">
          <MapPin size={14} aria-hidden="true" />
          <span>{regionLabel(item)}</span>
        </p>
      </div>
      <div className="visit-log-card-stats">
        <span className="saved-place-stat is-hearted">
          <Heart size={13} aria-hidden="true" fill="currentColor" />
          {item.heartCount}
        </span>
      </div>
    </Link>
  );
}

function savedPlacesFilter(value: string | string[] | undefined): SavedPlacesFilter {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return savedPlacesFilterSchema.catch("all").parse(firstValue ?? "all");
}

function summarizeSavedPlaces(items: SavedPlaceItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.wantToGo) summary.wantToGoCount += 1;
      if (item.hearted) summary.heartedCount += 1;
      return summary;
    },
    { heartedCount: 0, wantToGoCount: 0 }
  );
}

function placeHref(placeId: string): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent("/saved-places")}` as Route;
}

function regionLabel(item: Pick<SavedPlaceItem, "regionSido" | "regionSigungu">) {
  return [item.regionSido, item.regionSigungu].filter(Boolean).join(" ") || "지역 정보 없음";
}

function emptyTitle(filter: SavedPlacesFilter) {
  if (filter === "wantToGo") return "가고 싶은 장소가 아직 없어요";
  if (filter === "hearted") return "하트 장소가 아직 없어요";
  return "첫 장소를 저장해보세요";
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
