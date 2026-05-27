import { CalendarDays, Camera, Eye, EyeOff, History, Home, MapPin, MessageSquareText, RotateCcw, Star } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { PlaceCategoryBadge } from "@/app/place-category-badge";
import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { listMyVisitLog, type MyVisitLogItem } from "@/lib/place-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VisitsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const params = await searchParams;
  const demoMode = isVisitLogDemoMode(params);
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  if (!user && !demoMode) {
    return (
      <div className="page visits-page">
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">방문 로그</p>
            <h1>로그인 후 방문 기록을 볼 수 있어요</h1>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action" href="/">
              <Home size={15} aria-hidden="true" />
              AiGo 홈
            </Link>
            <Link className="empty-state-action is-primary" href="/login?next=/visits">
              <History size={15} aria-hidden="true" />
              로그인
            </Link>
          </div>
        </section>
      </div>
    );
  }

  let groups: Array<{ items: MyVisitLogItem[]; visitedOn: string }>;
  if (demoMode) {
    groups = demoVisitLogGroups();
  } else {
    if (!user) {
      throw new Error("Visit log requires an authenticated user outside demo mode.");
    }
    groups = (await listMyVisitLog(user.id)).groups;
  }
  const summary = summarizeVisits(groups);

  return (
    <div className="page visits-page">
      <header className="visits-hero">
        <div className="visits-hero-copy">
          <div className="visits-title-row">
            <p className="category">방문 로그</p>
            {demoMode ? <span className="visits-demo-badge">데모 데이터</span> : null}
          </div>
          <h1>우리 가족이 다녀온 곳</h1>
        </div>
        <div className="visits-hero-side">
          <div className="visits-summary" aria-label="방문 로그 요약">
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              {groups.length}일
            </span>
            <span>
              <MapPin size={15} aria-hidden="true" />
              {summary.visitCount}곳
            </span>
            <span>
              <RotateCcw size={15} aria-hidden="true" />
              재방문 {summary.revisitCount}
            </span>
            <span>
              <Camera size={15} aria-hidden="true" />
              사진 {summary.photoCount}
            </span>
          </div>
          <VisitPageActions />
        </div>
      </header>

      {groups.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">아직 기록 없음</p>
            <h2>장소 상세에서 첫 평가를 남겨보세요</h2>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action" href="/">
              <Home size={15} aria-hidden="true" />
              AiGo 홈
            </Link>
            <Link className="empty-state-action is-primary" href="/">
              <MapPin size={15} aria-hidden="true" />
              장소 찾기
            </Link>
          </div>
        </section>
      ) : (
        <section className="visit-log-groups" aria-label="날짜별 방문 로그">
          {groups.map((group) => (
            <section className="visit-log-group" key={group.visitedOn}>
              <header className="visit-log-group-head">
                <time dateTime={group.visitedOn}>{formatVisitDate(group.visitedOn)}</time>
                <span>{group.items.length}곳 방문</span>
              </header>
              <div className="visit-log-items">
                {group.items.map((item) => (
                  <VisitLogCard item={item} key={item.id} />
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </div>
  );
}

function VisitLogCard({ item }: { item: MyVisitLogItem }) {
  const hasReview = item.reviewText && item.reviewText.trim().length > 0;
  const VisibilityIcon = item.visibility === "private" ? EyeOff : Eye;

  return (
    <Link className="visit-log-card" href={placeHref(item.placeId)} aria-label={`${item.placeName} 상세 보기`}>
      <div className="visit-log-card-body">
        <div className="visit-log-card-topline">
          <PlaceCategoryBadge category={item.primaryCategory} className="category-pill" />
          {item.isRevisit ? (
            <span className="trust-badge positive">
              <RotateCcw size={13} aria-hidden="true" />
              재방문
            </span>
          ) : null}
          <span className="trust-badge neutral">
            <VisibilityIcon size={13} aria-hidden="true" />
            {item.visibility === "private" ? "비공개" : "공개"}
          </span>
        </div>
        <h2>{item.placeName}</h2>
        <p className={hasReview ? "visit-log-review" : "visit-log-review is-empty"}>
          <MessageSquareText size={14} aria-hidden="true" />
          <span>{hasReview ? item.reviewText : "짧은 리뷰 없음"}</span>
        </p>
      </div>
      <div className="visit-log-card-stats">
        <span className="score-pill">
          <Star size={13} aria-hidden="true" />
          평점 {item.rating ?? "-"}
        </span>
        <span>
          <Camera size={13} aria-hidden="true" />
          사진 {item.photoCount}장
        </span>
      </div>
    </Link>
  );
}

function VisitPageActions() {
  return (
    <nav className="visits-actions" aria-label="방문 로그 이동">
      <Link className="visits-action" href="/">
        <Home size={15} aria-hidden="true" />
        AiGo 홈
      </Link>
      <Link className="visits-action is-primary" href="/">
        <MapPin size={15} aria-hidden="true" />
        장소 찾기
      </Link>
    </nav>
  );
}

function summarizeVisits(groups: Array<{ items: MyVisitLogItem[] }>) {
  return groups.reduce(
    (summary, group) => {
      for (const item of group.items) {
        summary.visitCount += 1;
        summary.photoCount += item.photoCount;
        if (item.isRevisit) summary.revisitCount += 1;
      }
      return summary;
    },
    { photoCount: 0, revisitCount: 0, visitCount: 0 }
  );
}

function placeHref(placeId: string): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent("/visits")}` as Route;
}

function isVisitLogDemoMode(params: Record<string, string | string[] | undefined>) {
  const value = params.demo;
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return process.env.NODE_ENV !== "production" && values.some((item) => item === "1" || item === "true");
}

function demoVisitLogGroups(): Array<{ items: MyVisitLogItem[]; visitedOn: string }> {
  return [
    {
      visitedOn: "2026-05-25",
      items: [
        demoVisitLogItem({
          id: "11111111-1111-4111-8111-111111111111",
          isRevisit: true,
          photoCount: 2,
          placeId: "ad3726bf-1809-4fd6-a13a-2ecaf8fb4405",
          placeName: "덴바스타 테마 키즈호텔",
          primaryCategory: "accommodation",
          rating: 5,
          reviewText:
            "비 오는 날에도 방 안에서 오래 놀 수 있어서 좋았고, 다음에는 물놀이 준비물을 더 챙겨가면 좋겠다고 느꼈어요.",
          visibility: "public"
        }),
        demoVisitLogItem({
          id: "22222222-2222-4222-8222-222222222222",
          isRevisit: false,
          photoCount: 0,
          placeId: "22222222-2222-4222-8222-222222222222",
          placeName: "아주 긴 이름의 실내 놀이터와 장난감 도서관 복합 공간",
          primaryCategory: "indoor_playground",
          rating: 4,
          reviewText: null,
          visibility: "private"
        })
      ]
    },
    {
      visitedOn: "2026-05-18",
      items: [
        demoVisitLogItem({
          id: "33333333-3333-4333-8333-333333333333",
          isRevisit: false,
          photoCount: 1,
          placeId: "33333333-3333-4333-8333-333333333333",
          placeName: "한밭수목원",
          primaryCategory: "park",
          rating: 4,
          reviewText:
            "유모차로 걷기 편했고 그늘을 따라 움직이면 짧게 산책하기 좋았어요. 다만 점심 시간에는 주차와 화장실 동선이 조금 붐볐습니다.",
          visitedOn: "2026-05-18",
          visibility: "public"
        })
      ]
    }
  ];
}

function demoVisitLogItem(input: {
  id: string;
  isRevisit: boolean;
  photoCount: number;
  placeId: string;
  placeName: string;
  primaryCategory: string;
  rating: number;
  reviewText: string | null;
  visitedOn?: string;
  visibility: "public" | "private";
}): MyVisitLogItem {
  const visitedOn = input.visitedOn ?? "2026-05-25";
  return {
    createdAt: `${visitedOn}T00:00:00.000Z`,
    displayName: null,
    id: input.id,
    isMine: true,
    isPrivatePlaceholder: false,
    isRevisit: input.isRevisit,
    photoCount: input.photoCount,
    photos: [],
    placeId: input.placeId,
    placeName: input.placeName,
    primaryCategory: input.primaryCategory,
    rating: input.rating,
    reviewText: input.reviewText,
    updatedAt: `${visitedOn}T00:00:00.000Z`,
    visitedOn,
    visibility: input.visibility
  };
}

function formatVisitDate(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Seoul",
    weekday: "short",
    year: "numeric"
  }).format(date);
}
