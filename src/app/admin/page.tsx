import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, MapPin, Search, ShieldCheck, UserRound, Users, Wifi } from "lucide-react";
import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppPageHeader } from "@/app/page-shell";
import { placeCategoryLabel } from "@/app/place-category-badge";
import { PlaceResultCard, type PlaceResultCardDate, type PlaceResultCardMetric } from "@/app/place-result-card";
import { placeQualityScoreTitle } from "@/app/result-score-labels";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { adminPlacesDateSchema, adminPlacesLimitSchema, adminPlacesMonthSchema, adminPlacesSortSchema, listAdminPlaceDayCounts, listAdminPlaces, type AdminPlaceDayCount, type AdminPlaceItem, type AdminPlacesSort } from "@/lib/admin-places";
import { adminUsersLimitSchema, getAdminUsersSummary, listAdminUsers, type AdminUserItem } from "@/lib/admin-users";
import { getVisitEventsSummary, listVisitEvents, visitEventsLimitSchema, visitEventsSourceSchema, visitEventsTypeSchema, type VisitEventItem } from "@/lib/visit-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AdminTab = "visits" | "users" | "places";

const DEFAULT_ADMIN_LIMIT = 25;
const DEFAULT_ADMIN_PLACE_LIMIT = 50;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  if (!user) {
    redirect("/login?next=/admin");
  }
  if (user.role !== "admin") {
    notFound();
  }

  const query = await searchParams;
  const tab = parseAdminTab(firstQueryValue(query.tab));
  const eventType = visitEventsTypeSchema.parse(firstQueryValue(query.type) ?? "all");
  const eventSource = visitEventsSourceSchema.parse(firstQueryValue(query.source) ?? "all");
  const userId = textQuery(query.userId);
  const ipAddress = textQuery(query.ip);
  const placeDate = parseAdminPlaceDate(firstQueryValue(query.date));
  const placeMonth = parseAdminPlaceMonth(firstQueryValue(query.month), placeDate);
  const placeSort = parseAdminPlaceSort(firstQueryValue(query.sort));
  const limit = adminLimit(tab, firstQueryValue(query.limit));
  const page = adminPage(firstQueryValue(query.page));
  const offset = (page - 1) * limit;
  const [visitSummary, events, userSummary, users, placeDayCounts, places] = await Promise.all([
    getVisitEventsSummary(),
    tab === "visits" ? listVisitEvents({ eventSource, eventType, ipAddress, limit, offset, userId }) : Promise.resolve({ items: [], totalCount: 0 }),
    getAdminUsersSummary(),
    tab === "users" ? listAdminUsers({ limit, offset }) : Promise.resolve({ items: [] }),
    tab === "places" ? listAdminPlaceDayCounts({ month: placeMonth }) : Promise.resolve({ items: [] }),
    tab === "places" ? listAdminPlaces({ date: placeDate, limit, offset, sort: placeSort }) : Promise.resolve({ items: [], totalCount: 0 })
  ]);
  const totalItems = tab === "visits" ? events.totalCount : tab === "users" ? userSummary.totalCount : places.totalCount;

  return (
    <div className="page app-page admin-page">
      <AppPageHeader
        eyebrow="관리자"
        icon={ShieldCheck}
        title={tab === "users" ? "사용자 관리" : tab === "places" ? "장소관리" : "방문 기록"}
        actions={<AdminPrimaryTabs activeTab={tab} />}
      />
      {tab === "visits" ? (
        <div className="admin-nav-bar">
          <div className="admin-filter-tabs" aria-label="방문 기록 필터">
            {filterLinks.map((filter) => {
              const Icon = filter.icon;
              return (
                <Link className={`admin-filter-tab ${eventType === filter.value ? "is-active" : ""}`} href={`/admin?tab=visits&type=${filter.value}&limit=${limit}`} key={filter.value}>
                  <Icon size={14} aria-hidden="true" />
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "visits" ? (
        <>
          <section className="admin-summary-grid" aria-label="방문 기록 요약">
            <SummaryCard icon={<Activity size={18} aria-hidden="true" />} label="전체" value={visitSummary.totalCount} />
            <SummaryCard icon={<Eye size={18} aria-hidden="true" />} label="상세조회" value={visitSummary.detailViewCount} />
            <SummaryCard icon={<Search size={18} aria-hidden="true" />} label="검색" value={visitSummary.searchCount} />
          </section>
          <ActiveVisitFilters eventSource={eventSource} eventType={eventType} ipAddress={ipAddress} limit={limit} userId={userId} />

          <section className="admin-log-panel">
            <div className="admin-section-head">
              <h2>최근 이벤트</h2>
              <span>{events.items.length}개 표시</span>
            </div>
            <div className="admin-log-list">
              {events.items.length > 0 ? events.items.map((event) => <VisitEventRow event={event} eventType={eventType} key={event.id} limit={limit} />) : <p className="admin-empty">기록이 없습니다.</p>}
            </div>
            <AdminPager baseParams={visitListParams({ eventSource, eventType, ipAddress, userId })} itemCount={events.items.length} limit={limit} page={page} totalItems={totalItems} />
          </section>
        </>
      ) : tab === "users" ? (
        <>
          <section className="admin-summary-grid" aria-label="사용자 요약">
            <SummaryCard icon={<Users size={18} aria-hidden="true" />} label="가입 사용자" value={userSummary.totalCount} />
            <SummaryCard icon={<ShieldCheck size={18} aria-hidden="true" />} label="관리자" value={userSummary.adminCount} />
            <SummaryCard icon={<Clock size={18} aria-hidden="true" />} label="방문 기록 있는 사용자" value={userSummary.visitedUserCount} />
          </section>

          <section className="admin-log-panel">
            <div className="admin-section-head">
              <h2>가입 사용자</h2>
              <span>{users.items.length}명 표시</span>
            </div>
            <div className="admin-user-list">
              {users.items.length > 0 ? users.items.map((item) => <AdminUserRow item={item} key={item.id} />) : <p className="admin-empty">가입 사용자가 없습니다.</p>}
            </div>
            <AdminPager baseParams={{ tab: "users" }} itemCount={users.items.length} limit={limit} page={page} totalItems={totalItems} />
          </section>
        </>
      ) : (
        <>
          <PlaceRegistrationCalendar counts={placeDayCounts.items} limit={limit} month={placeMonth} selectedDate={placeDate} sort={placeSort} />

          <section className="admin-log-panel">
            <div className="admin-place-list">
              {places.items.length > 0 ? (
                places.items.map((item, index) => <AdminPlaceRow index={offset + index + 1} item={item} key={item.id} returnHref={adminPageHref(placeListParams({ date: placeDate, month: placeMonth, sort: placeSort }), page, limit)} sort={placeSort} />)
              ) : (
                <p className="admin-empty">등록된 장소가 없습니다.</p>
              )}
            </div>
            <AdminPager
              baseParams={placeListParams({ date: placeDate, month: placeMonth, sort: placeSort })}
              controls={<PlaceSortTabs date={placeDate} limit={limit} month={placeMonth} sort={placeSort} />}
              itemCount={places.items.length}
              limit={limit}
              page={page}
              totalItems={totalItems}
            />
          </section>
        </>
      )}
    </div>
  );
}

const adminTabs = [
  { icon: Activity, label: "방문 기록", value: "visits" },
  { icon: Users, label: "사용자 관리", value: "users" },
  { icon: MapPin, label: "장소관리", value: "places" }
] as const;

const filterLinks = [
  { icon: Activity, label: "전체", value: "all" },
  { icon: Eye, label: "상세조회", value: "place_detail_view" },
  { icon: Search, label: "검색", value: "place_search" }
] as const;

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="admin-summary-card">
      {icon}
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function PlaceRegistrationCalendar({ counts, limit, month, selectedDate, sort }: { counts: AdminPlaceDayCount[]; limit: number; month: string; selectedDate: string | null; sort: AdminPlacesSort }) {
  const countByDate = new Map(counts.map((item) => [item.date, item.count]));
  const weeks = buildMonthCalendar(month);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  return (
    <section className="admin-calendar-panel" aria-label="장소 등록 달력">
      <div className="admin-calendar-head">
        <div className="admin-calendar-actions">
          <Link className="admin-calendar-icon-link" href={adminPlaceMonthHref(previousMonth, limit, sort)} aria-label={`${formatMonthLabel(previousMonth)} 보기`}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
          <form className="admin-calendar-jump" action="/admin" key={month}>
            <input type="hidden" name="tab" value="places" />
            <input type="hidden" name="limit" value={String(limit)} />
            <input type="hidden" name="sort" value={sort} />
            <CalendarDays size={14} aria-hidden="true" />
            <input aria-label="장소 등록 월 선택" type="month" name="month" defaultValue={month} key={month} />
            <button type="submit">이동</button>
          </form>
          <Link className="admin-calendar-icon-link" href={adminPlaceMonthHref(nextMonth, limit, sort)} aria-label={`${formatMonthLabel(nextMonth)} 보기`}>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
          <Link className="admin-calendar-today-link" href={adminPlaceMonthHref(currentKoreaMonth(), limit, sort)}>
            이번 달
          </Link>
          {selectedDate ? (
            <Link className="admin-calendar-today-link" href={adminPlaceMonthHref(month, limit, sort)}>
              전체 보기
            </Link>
          ) : null}
        </div>
      </div>
      <div className="admin-calendar-weekdays" aria-hidden="true">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="admin-calendar-grid">
        {weeks.flat().map((day, index) => {
          if (!day) return <span className="admin-calendar-day is-empty" key={`empty-${index}`} />;
          const count = countByDate.get(day.date) ?? 0;
          return (
            <Link className={`admin-calendar-day ${selectedDate === day.date ? "is-selected" : ""} ${count > 0 ? "has-count" : ""}`} href={adminPlaceDateHref(day.date, limit, sort)} key={day.date}>
              <strong>{day.day}</strong>
              {count > 0 ? <span>{formatNumber(count)}</span> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AdminPrimaryTabs({ activeTab }: { activeTab: AdminTab }) {
  return (
    <nav className="admin-primary-tabs" aria-label="관리자 메뉴">
      {adminTabs.map((item) => {
        const Icon = item.icon;
        return (
          <Link className={`admin-primary-tab ${activeTab === item.value ? "is-active" : ""}`} href={adminTabHref(item.value)} key={item.value}>
            <Icon size={15} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PlaceSortTabs({ date, limit, month, sort }: { date: string | null; limit: number; month: string; sort: AdminPlacesSort }) {
  const options: Array<{ label: string; value: AdminPlacesSort }> = [
    { label: "최근등록일", value: "created" },
    { label: "최근수정일", value: "updated" }
  ];
  return (
    <div className="admin-place-sort-tabs" aria-label="장소 정렬 기준">
      {options.map((option) => (
        <Link className={`admin-place-sort-tab ${sort === option.value ? "is-active" : ""}`} href={adminPlaceSortHref({ date, limit, month, sort: option.value })} key={option.value}>
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function ActiveVisitFilters({
  eventSource,
  eventType,
  ipAddress,
  limit,
  userId
}: {
  eventSource: string;
  eventType: string;
  ipAddress: string | null;
  limit: number;
  userId: string | null;
}) {
  const filters = [
    eventType !== "all" ? { key: "type", label: eventType === "place_detail_view" ? "상세조회" : "검색", value: "유형" } : null,
    eventSource !== "all" ? { key: "source", label: eventSource, value: "소스" } : null,
    userId ? { key: "userId", label: shortId(userId), value: "사용자" } : null,
    ipAddress ? { key: "ip", label: ipAddress, value: "IP" } : null
  ].filter(Boolean) as Array<{ key: "ip" | "source" | "type" | "userId"; label: string; value: string }>;

  if (filters.length === 0) return null;

  return (
    <div className="admin-active-filters" aria-label="적용 중인 방문 기록 필터">
      <span>모아보기</span>
      {filters.map((filter) => (
        <Link
          className="admin-active-filter-chip"
          href={adminVisitFilterRemoveHref({ eventSource, eventType, ipAddress, limit, removeKey: filter.key, userId })}
          key={`${filter.value}-${filter.label}`}
          aria-label={`${filter.value} ${filter.label} 필터 해제`}
        >
          <small>{filter.value}</small>
          {filter.label}
          <span className="admin-active-filter-remove" aria-hidden="true">
            ×
          </span>
        </Link>
      ))}
    </div>
  );
}

function AdminPager({
  baseParams,
  controls,
  itemCount,
  limit,
  page,
  totalItems
}: {
  baseParams: Record<string, string>;
  controls?: ReactNode;
  itemCount: number;
  limit: number;
  page: number;
  totalItems: number;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min((page - 1) * limit + itemCount, totalItems);
  const hasPrevious = page > 1;
  const hasNext = page * limit < totalItems;

  return (
    <footer className="admin-pager" aria-label="관리자 목록 페이지 이동">
      <div className="admin-pager-meta">
        <span className="admin-pager-status">
          {formatNumber(start)}-{formatNumber(end)} / {formatNumber(totalItems)}
        </span>
      </div>
      <div className="admin-pager-actions">
        {controls}
        {hasPrevious ? (
          <Link className="admin-pager-link" href={adminPageHref(baseParams, page - 1, limit)}>
            이전
          </Link>
        ) : (
          <span className="admin-pager-link is-disabled">이전</span>
        )}
        <span className="admin-pager-page">{formatNumber(page)}</span>
        {hasNext ? (
          <Link className="admin-pager-link" href={adminPageHref(baseParams, page + 1, limit)}>
            다음
          </Link>
        ) : (
          <span className="admin-pager-link is-disabled">다음</span>
        )}
      </div>
    </footer>
  );
}

function AdminUserRow({ item }: { item: AdminUserItem }) {
  return (
    <article className="admin-user-row">
      <div className="admin-user-main">
        <div className="admin-log-title-row">
          <span className={`admin-role-badge is-${item.role === "admin" ? "admin" : "user"}`}>{item.role === "admin" ? "관리자" : "사용자"}</span>
          <strong>{item.displayName}</strong>
          <small>{item.email}</small>
        </div>
        <div className="admin-log-meta">
          <span>수정 {formatDateTime(item.updatedAt)}</span>
          <span>소셜 {item.socialProviders.length > 0 ? item.socialProviders.join(", ") : "없음"}</span>
        </div>
      </div>
      <div className="admin-user-stats">
        <Stat label="최초 가입일" value={formatDateTime(item.createdAt)} />
        <Stat label="마지막 로그인" value={item.lastSessionUsedAt ? formatDateTime(item.lastSessionUsedAt) : "기록 없음"} />
        <Stat label="마지막 방문" value={item.lastVisitAt ? formatDateTime(item.lastVisitAt) : "기록 없음"} />
        <Stat label="상세/검색" value={`${formatNumber(item.detailViewCount)} / ${formatNumber(item.searchCount)}`} />
        <Stat label="전체 이벤트" value={formatNumber(item.totalEventCount)} />
      </div>
    </article>
  );
}

function AdminPlaceRow({ index, item, returnHref, sort }: { index: number; item: AdminPlaceItem; returnHref: Route; sort: AdminPlacesSort }) {
  const summary = adminPlaceSummary(item);
  const keywords = adminPlaceKeywords(item);
  const date = adminPlaceDate(item, sort);
  const metrics = adminPlaceMetrics(item);

  return (
    <PlaceResultCard
      category={item.primaryCategory}
      className="admin-place-card"
      dates={[date]}
      href={`/places/${item.id}?returnTo=${encodeURIComponent(returnHref)}`}
      imageAlt={item.imageAltText ?? `${item.name} 대표 이미지`}
      imageUrl={item.imageUrl}
      keywords={keywords}
      metrics={metrics}
      metricAriaLabel={item.placeScore !== null ? placeQualityScoreTitle(item.placeScore) : "장소 평가 점수가 없습니다."}
      name={item.name}
      rank={index}
      showImageCategory
      summary={summary}
      tags={item.tags}
    />
  );
}

function adminPlaceDate(item: AdminPlaceItem, sort: AdminPlacesSort): PlaceResultCardDate {
  return sort === "updated" ? { label: "수정", value: formatDateTime(item.updatedAt) } : { label: "등록", value: formatDateTime(item.createdAt) };
}

function adminPlaceMetrics(item: AdminPlaceItem): PlaceResultCardMetric[] {
  return [
    {
      icon: "evaluation",
      key: "evaluation",
      label: "평가",
      title: item.placeScore !== null ? placeQualityScoreTitle(item.placeScore) : "장소 평가 점수가 없습니다.",
      tone: item.placeScore !== null ? adminScoreTone(item.placeScore) : undefined,
      value: item.placeScore !== null ? String(Math.round(item.placeScore)) : "-"
    }
  ];
}

function adminPlaceSummary(item: AdminPlaceItem) {
  return firstText([item.parentNotes, item.safetyNotes, item.description]) ?? `${placeCategoryLabel(item.primaryCategory)} 장소`;
}

function adminPlaceKeywords(item: AdminPlaceItem) {
  return Array.from(new Set(item.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 4);
}

function firstText(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function adminScoreTone(score: number) {
  if (score >= 65) return "score-high";
  if (score >= 58) return "score-good";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="admin-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function VisitEventRow({ event, eventType, limit }: { event: VisitEventItem; eventType: string; limit: number }) {
  const uaSummary = typeof event.userAgentAnalysis.summary === "string" ? event.userAgentAnalysis.summary : "unknown";
  const eventTitle =
    event.eventType === "place_detail_view"
      ? (event.place?.name ?? "장소 상세조회")
      : `검색 ${event.searchResultTotal === null ? "" : `${formatNumber(event.searchResultTotal)}건`}`.trim();

  return (
    <article className="admin-log-row">
      <div className="admin-log-main">
        <div className="admin-log-title-row">
          <span className={`admin-event-badge is-${event.eventType}`}>{event.eventType === "place_detail_view" ? "상세" : "검색"}</span>
          <strong>{eventTitle}</strong>
          <small>{formatDateTime(event.createdAt)}</small>
        </div>
        <div className="admin-log-meta">
          {event.ipAddress ? (
            <Link className="admin-meta-link" href={adminVisitFilterHref({ eventType, ipAddress: event.ipAddress, limit })}>
              <Wifi size={12} aria-hidden="true" />
              {event.ipAddress}
            </Link>
          ) : (
            <span>IP 없음</span>
          )}
          {event.user?.id ? (
            <Link className="admin-meta-link" href={adminVisitFilterHref({ eventType, limit, userId: event.user.id })}>
              <UserRound size={12} aria-hidden="true" />
              {event.user.displayName ?? event.user.email ?? "사용자"}
            </Link>
          ) : (
            <span>비회원</span>
          )}
          <Link className="admin-meta-link" href={adminVisitFilterHref({ eventSource: event.eventSource, eventType, limit })}>
            {event.eventSource}
          </Link>
          <span>{event.requestPath ?? "-"}</span>
        </div>
        {event.eventType === "place_search" ? <SearchInputSummary input={event.searchInput} /> : null}
      </div>
      <div className="admin-ua-panel">
        <span>UA 분석</span>
        <strong>{uaSummary}</strong>
        <UaAnalysisChips analysis={event.userAgentAnalysis} />
      </div>
    </article>
  );
}

function UaAnalysisChips({ analysis }: { analysis: Record<string, unknown> }) {
  const browser = objectValue(analysis.browser);
  const os = objectValue(analysis.os);
  const platform = objectValue(analysis.platform);
  const engine = objectValue(analysis.engine);
  const chips = [
    namedValue("브라우저", browser.name, browser.version),
    namedValue("OS", os.name, os.version),
    namedValue("기기", platform.type, platform.vendor, platform.model),
    namedValue("엔진", engine.name, engine.version),
    analysis.isBot === true ? "bot" : null
  ].filter(Boolean);

  return chips.length > 0 ? (
    <div className="admin-search-input">
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </div>
  ) : (
    <small>분석 정보 없음</small>
  );
}

function SearchInputSummary({ input }: { input: Record<string, unknown> }) {
  const chips = [
    stringChip("query", input.query),
    stringChip("sort", input.sort),
    numberChip("limit", input.limit),
    numberChip("offset", input.offset),
    Array.isArray(input.categories) && input.categories.length > 0 ? `category ${input.categories.length}` : null,
    Array.isArray(input.tags) && input.tags.length > 0 ? `tag ${input.tags.length}` : null
  ].filter(Boolean);

  return chips.length > 0 ? (
    <div className="admin-search-input">
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </div>
  ) : (
    <div className="admin-search-input">
      <span>조건 없음</span>
    </div>
  );
}

function stringChip(label: string, value: unknown) {
  return typeof value === "string" && value.trim() ? `${label} ${value}` : null;
}

function numberChip(label: string, value: unknown) {
  return typeof value === "number" ? `${label} ${value}` : null;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function namedValue(label: string, ...values: unknown[]) {
  const parts = values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return parts.length > 0 ? `${label} ${parts.join(" ")}` : null;
}

function parseAdminTab(value: string | undefined): AdminTab {
  if (value === "users" || value === "places") return value;
  return "visits";
}

function adminLimit(tab: AdminTab, value: string | undefined) {
  const fallback = value ?? String(tab === "places" ? DEFAULT_ADMIN_PLACE_LIMIT : DEFAULT_ADMIN_LIMIT);
  if (tab === "users") return adminUsersLimitSchema.parse(fallback);
  if (tab === "places") return adminPlacesLimitSchema.parse(fallback);
  return visitEventsLimitSchema.parse(fallback);
}

function adminTabHref(tab: AdminTab) {
  return `/admin?tab=${tab}` as Route;
}

function adminPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function visitListParams({
  eventSource,
  eventType,
  ipAddress,
  userId
}: {
  eventSource: string;
  eventType: string;
  ipAddress: string | null;
  userId: string | null;
}) {
  return {
    tab: "visits",
    ...(eventType !== "all" ? { type: eventType } : {}),
    ...(eventSource !== "all" ? { source: eventSource } : {}),
    ...(ipAddress ? { ip: ipAddress } : {}),
    ...(userId ? { userId } : {})
  };
}

function placeListParams({ date, month, sort }: { date: string | null; month: string; sort: AdminPlacesSort }) {
  return {
    tab: "places",
    month,
    sort,
    ...(date ? { date } : {})
  };
}

function adminVisitFilterHref({
  eventSource,
  eventType,
  ipAddress,
  limit,
  userId
}: {
  eventSource?: string;
  eventType: string;
  ipAddress?: string;
  limit: number;
  userId?: string;
}) {
  const query = new URLSearchParams({ limit: String(limit), tab: "visits" });
  if (eventType !== "all") query.set("type", eventType);
  if (eventSource && eventSource !== "all") query.set("source", eventSource);
  if (ipAddress) query.set("ip", ipAddress);
  if (userId) query.set("userId", userId);
  return `/admin?${query.toString()}` as Route;
}

function adminVisitFilterRemoveHref({
  eventSource,
  eventType,
  ipAddress,
  limit,
  removeKey,
  userId
}: {
  eventSource: string;
  eventType: string;
  ipAddress: string | null;
  limit: number;
  removeKey: "ip" | "source" | "type" | "userId";
  userId: string | null;
}) {
  return adminVisitFilterHref({
    eventSource: removeKey === "source" ? "all" : eventSource,
    eventType: removeKey === "type" ? "all" : eventType,
    ipAddress: removeKey === "ip" ? undefined : (ipAddress ?? undefined),
    limit,
    userId: removeKey === "userId" ? undefined : (userId ?? undefined)
  });
}

function adminPageHref(params: Record<string, string>, page: number, limit: number) {
  const query = new URLSearchParams({ ...params, limit: String(limit) });
  if (page > 1) query.set("page", String(page));
  return `/admin?${query.toString()}` as Route;
}

function adminPlaceMonthHref(month: string, limit: number, sort: AdminPlacesSort) {
  const query = new URLSearchParams({ limit: String(limit), month, sort, tab: "places" });
  return `/admin?${query.toString()}` as Route;
}

function adminPlaceDateHref(date: string, limit: number, sort: AdminPlacesSort) {
  const query = new URLSearchParams({ date, limit: String(limit), month: date.slice(0, 7), sort, tab: "places" });
  return `/admin?${query.toString()}` as Route;
}

function adminPlaceSortHref({ date, limit, month, sort }: { date: string | null; limit: number; month: string; sort: AdminPlacesSort }) {
  const query = new URLSearchParams({ limit: String(limit), month, sort, tab: "places" });
  if (date) query.set("date", date);
  return `/admin?${query.toString()}` as Route;
}

function textQuery(value: string | string[] | undefined) {
  const first = firstQueryValue(value);
  return first && first.trim().length > 0 ? first.trim() : null;
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseAdminPlaceDate(value: string | undefined) {
  return adminPlacesDateSchema.safeParse(value ?? null).success ? (value ?? null) : null;
}

function parseAdminPlaceMonth(value: string | undefined, selectedDate: string | null) {
  const fallback = selectedDate?.slice(0, 7) ?? currentKoreaMonth();
  const parsed = adminPlacesMonthSchema.safeParse(value ?? fallback);
  return parsed.success && parsed.data ? parsed.data : fallback;
}

function parseAdminPlaceSort(value: string | undefined) {
  const parsed = adminPlacesSortSchema.safeParse(value ?? "created");
  return parsed.success ? parsed.data : "created";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(new Date(`${value}-01T00:00:00+09:00`));
}

function currentKoreaMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  })
    .format(new Date())
    .slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthCalendar(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: Array<{ date: string; day: number } | null> = Array.from({ length: firstDay.getUTCDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: `${month}-${String(day).padStart(2, "0")}`, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<{ date: string; day: number } | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}
