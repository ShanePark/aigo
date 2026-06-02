import { Activity, Clock, Eye, Search, ShieldCheck, Users } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppPageHeader } from "@/app/page-shell";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { getAdminUsersSummary, listAdminUsers, type AdminUserItem } from "@/lib/admin-users";
import { getVisitEventsSummary, listVisitEvents, visitEventsLimitSchema, visitEventsTypeSchema, type VisitEventItem } from "@/lib/visit-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AdminTab = "visits" | "users";

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
  const limit = visitEventsLimitSchema.parse(firstQueryValue(query.limit) ?? 50);
  const [visitSummary, events, userSummary, users] = await Promise.all([
    getVisitEventsSummary(),
    tab === "visits" ? listVisitEvents({ eventType, limit }) : Promise.resolve({ items: [] }),
    getAdminUsersSummary(),
    tab === "users" ? listAdminUsers({ limit }) : Promise.resolve({ items: [] })
  ]);

  return (
    <div className="page app-page admin-page">
      <AppPageHeader
        eyebrow="관리자"
        icon={ShieldCheck}
        title={tab === "users" ? "사용자 관리" : "방문 기록"}
        actions={
          <>
            <nav className="app-page-filter-group" aria-label="관리자 메뉴">
              {adminTabs.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className={`app-page-filter-chip ${tab === item.value ? "is-active" : ""}`} href={`/admin?tab=${item.value}&limit=${limit}`} key={item.value}>
                    <Icon size={14} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {tab === "visits" ? (
              <div className="app-page-filter-group" aria-label="방문 기록 필터">
                {filterLinks.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <Link className={`app-page-filter-chip ${eventType === filter.value ? "is-active" : ""}`} href={`/admin?tab=visits&type=${filter.value}&limit=${limit}`} key={filter.value}>
                      <Icon size={14} aria-hidden="true" />
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </>
        }
      />

      {tab === "visits" ? (
        <>
          <section className="admin-summary-grid" aria-label="방문 기록 요약">
            <SummaryCard icon={<Activity size={18} aria-hidden="true" />} label="전체" value={visitSummary.totalCount} />
            <SummaryCard icon={<Eye size={18} aria-hidden="true" />} label="상세조회" value={visitSummary.detailViewCount} />
            <SummaryCard icon={<Search size={18} aria-hidden="true" />} label="검색" value={visitSummary.searchCount} />
          </section>

          <section className="admin-log-panel">
            <div className="admin-section-head">
              <h2>최근 이벤트</h2>
              <span>{events.items.length}개 표시</span>
            </div>
            <div className="admin-log-list">
              {events.items.length > 0 ? events.items.map((event) => <VisitEventRow event={event} key={event.id} />) : <p className="admin-empty">기록이 없습니다.</p>}
            </div>
          </section>
        </>
      ) : (
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
          </section>
        </>
      )}
    </div>
  );
}

const adminTabs = [
  { icon: Activity, label: "방문 기록", value: "visits" },
  { icon: Users, label: "사용자 관리", value: "users" }
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="admin-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function VisitEventRow({ event }: { event: VisitEventItem }) {
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
          <span>{event.ipAddress ?? "IP 없음"}</span>
          <span>{event.user?.displayName ?? event.user?.email ?? "비회원"}</span>
          <span>{event.eventSource}</span>
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
  return value === "users" ? "users" : "visits";
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
