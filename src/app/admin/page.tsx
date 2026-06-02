import { Activity, Eye, Search, ShieldCheck, Smartphone } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { getVisitEventsSummary, listVisitEvents, visitEventsLimitSchema, visitEventsTypeSchema, type VisitEventItem } from "@/lib/visit-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const eventType = visitEventsTypeSchema.parse(firstQueryValue(query.type) ?? "all");
  const limit = visitEventsLimitSchema.parse(firstQueryValue(query.limit) ?? 50);
  const [summary, events] = await Promise.all([getVisitEventsSummary(), listVisitEvents({ eventType, limit })]);

  return (
    <div className="page admin-page">
      <header className="admin-head">
        <div>
          <span className="admin-eyebrow">
            <ShieldCheck size={15} aria-hidden="true" />
            관리자
          </span>
          <h1>방문 기록</h1>
        </div>
        <div className="admin-filter-row" aria-label="방문 기록 필터">
          {filterLinks.map((filter) => (
            <Link className={`admin-filter-chip ${eventType === filter.value ? "is-active" : ""}`} href={`/admin?type=${filter.value}&limit=${limit}`} key={filter.value}>
              {filter.label}
            </Link>
          ))}
        </div>
      </header>

      <section className="admin-summary-grid" aria-label="방문 기록 요약">
        <SummaryCard icon={<Activity size={18} aria-hidden="true" />} label="전체" value={summary.totalCount} />
        <SummaryCard icon={<Eye size={18} aria-hidden="true" />} label="상세조회" value={summary.detailViewCount} />
        <SummaryCard icon={<Search size={18} aria-hidden="true" />} label="검색" value={summary.searchCount} />
        <SummaryCard icon={<Smartphone size={18} aria-hidden="true" />} label="UA 미처리" value={summary.unprocessedUaCount} />
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
    </div>
  );
}

const filterLinks = [
  { label: "전체", value: "all" },
  { label: "상세조회", value: "place_detail_view" },
  { label: "검색", value: "place_search" }
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

function VisitEventRow({ event }: { event: VisitEventItem }) {
  const uaSummary = typeof event.userAgentAnalysis.summary === "string" ? event.userAgentAnalysis.summary : event.uaProcessed ? "분석됨" : "분석 대기";
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
        <span className={event.uaProcessed ? "is-processed" : "is-pending"}>{event.uaProcessed ? "UA 처리 완료" : "UA 분석 대기"}</span>
        <strong>{uaSummary}</strong>
        <small>{event.userAgent ? truncate(event.userAgent, 120) : "User-Agent 없음"}</small>
      </div>
    </article>
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

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
