import { Bookmark, Heart, MapPin, type LucideIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { PlaceImage } from "@/app/place-image";
import { PlaceCategoryBadge } from "@/app/place-category-badge";
import { AppPageHeader } from "@/app/page-shell";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import {
  getSavedPlacesSummary,
  listSavedPlaces,
  savedPlacesFilterSchema,
  type SavedPlaceItem,
  type SavedPlacesFilter,
  type SavedPlacesSummary
} from "@/lib/user-place-saves";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedPlacesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FILTERS: Array<{ getCount: (summary: SavedPlacesSummary) => number; href: Route; icon: LucideIcon; label: string; value: SavedPlacesFilter }> = [
  { getCount: (summary) => summary.totalCount, href: "/saved-places", icon: Bookmark, label: "전체", value: "all" },
  { getCount: (summary) => summary.wantToGoCount, href: "/saved-places?filter=wantToGo", icon: Bookmark, label: "찜", value: "wantToGo" },
  { getCount: (summary) => summary.heartedCount, href: "/saved-places?filter=hearted", icon: Heart, label: "하트", value: "hearted" }
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
            <h1>로그인 후 저장한 장소를 볼 수 있어요</h1>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action is-primary" href="/login?next=/saved-places">
              <Bookmark size={15} aria-hidden="true" />
              로그인
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const [{ items }, summary] = await Promise.all([listSavedPlaces(user.id, filter), getSavedPlacesSummary(user.id)]);

  return (
    <div className="page app-page collection-page">
      <AppPageHeader icon={Bookmark} title="저장한 장소" actions={<SavedPlaceFilters activeFilter={filter} summary={summary} />} />

      {items.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <Bookmark size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <h2>{emptyTitle(filter)}</h2>
          </div>
        </section>
      ) : (
        <section className="place-collection-list" aria-label="저장한 장소 목록">
          {items.map((item) => (
            <SavedPlaceCard item={item} key={item.placeId} />
          ))}
        </section>
      )}
    </div>
  );
}

function SavedPlaceFilters({ activeFilter, summary }: { activeFilter: SavedPlacesFilter; summary: SavedPlacesSummary }) {
  return (
    <nav className="limit-control saved-place-filters" aria-label="저장한 장소 필터">
      {FILTERS.map((filter) => {
        const Icon = filter.icon;
        const count = filter.getCount(summary);
        const iconFill = filter.value === "hearted" ? "currentColor" : "none";
        return (
          <Link className={`limit-option is-${filter.value} ${activeFilter === filter.value ? "is-active" : ""}`} href={filter.href} key={filter.value}>
            <Icon size={14} aria-hidden="true" fill={iconFill} />
            <span>{filter.label}</span>
            <span className="saved-place-filter-count">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SavedPlaceCard({ item }: { item: SavedPlaceItem }) {
  return (
    <Link className="place-collection-card" href={placeHref(item.placeId)} aria-label={`${item.placeName} 상세 보기`}>
      <PlaceImage category={item.primaryCategory} src={item.imageUrl} alt={`${item.placeName} 대표 이미지`} variant="result" />
      <div className="place-collection-card-body">
        <div className="visit-log-card-topline">
          <PlaceCategoryBadge category={item.primaryCategory} className="category-pill" name={item.placeName} />
          {item.wantToGo ? (
            <span className="trust-badge positive">
              <Bookmark size={13} aria-hidden="true" />
              찜
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

function placeHref(placeId: string): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent("/saved-places")}` as Route;
}

function regionLabel(item: Pick<SavedPlaceItem, "regionSido" | "regionSigungu">) {
  return [item.regionSido, item.regionSigungu].filter(Boolean).join(" ") || "지역 정보 없음";
}

function emptyTitle(filter: SavedPlacesFilter) {
  if (filter === "wantToGo") return "찜한 장소가 아직 없어요";
  if (filter === "hearted") return "하트 장소가 아직 없어요";
  return "첫 장소를 저장해보세요";
}
