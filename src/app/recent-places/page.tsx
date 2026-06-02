import { Clock, History, MapPin, MousePointerClick } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { PlaceImage } from "@/app/place-image";
import { PlaceCategoryBadge } from "@/app/place-category-badge";
import { AppPageHeader, AppPagePill, AppPagePills } from "@/app/page-shell";
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
            <h1>로그인 후 최근 확인한 장소를 볼 수 있어요</h1>
          </div>
          <div className="empty-state-actions">
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
    <div className="page app-page collection-page">
      <AppPageHeader
        icon={History}
        title="최근 본 장소"
        actions={
          <AppPagePills ariaLabel="최근 본 장소 요약">
            <AppPagePill>
              <History size={15} aria-hidden="true" />
              {items.length}곳
            </AppPagePill>
            <AppPagePill>
              <Clock size={15} aria-hidden="true" />
              최신순
            </AppPagePill>
          </AppPagePills>
        }
      />

      {items.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <h2>장소 상세를 열면 여기에 쌓여요</h2>
          </div>
        </section>
      ) : (
        <section className="place-collection-list" aria-label="최근 본 장소 목록">
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
    <Link className="place-collection-card" href={placeHref(item.placeId)} aria-label={`${item.placeName} 상세 보기`}>
      <PlaceImage category={item.primaryCategory} src={item.imageUrl} alt={`${item.placeName} 대표 이미지`} variant="result" />
      <div className="place-collection-card-body">
        <div className="visit-log-card-topline">
          <PlaceCategoryBadge category={item.primaryCategory} className="category-pill" name={item.placeName} />
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
