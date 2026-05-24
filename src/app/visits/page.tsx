import { CalendarDays, Camera, Eye, EyeOff, History, MapPin, MessageSquareText, RotateCcw, Star } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { listMyVisitLog, type MyVisitLogItem } from "@/lib/place-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function VisitsPage() {
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
            <p className="empty-state-kicker">방문 로그</p>
            <h1>로그인 후 방문 기록을 볼 수 있어요</h1>
            <p>상단의 dev 로그인 버튼으로 들어오면 내가 남긴 장소 평가, 방문일, 사진 수를 날짜별로 확인할 수 있습니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action is-primary" href="/">
              <MapPin size={15} aria-hidden="true" />
              장소 찾기
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { groups } = await listMyVisitLog(user.id);
  const summary = summarizeVisits(groups);

  return (
    <div className="page visits-page">
      <header className="visits-hero">
        <div>
          <p className="category">방문 로그</p>
          <h1>우리 가족이 다녀온 곳</h1>
          <p className="lede">날짜별 방문 장소와 별점, 짧은 리뷰, 사진 수를 한눈에 모아 봅니다.</p>
        </div>
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
      </header>

      {groups.length === 0 ? (
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <History size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">아직 기록 없음</p>
            <h2>장소 상세에서 첫 평가를 남겨보세요</h2>
            <p>장소 상세에서 별점과 리뷰를 저장하면 오늘 날짜로 로그가 쌓입니다.</p>
          </div>
          <div className="empty-state-actions">
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
    <Link className="visit-log-card" href={placeHref(item.placeId)}>
      <div className="visit-log-card-body">
        <div className="visit-log-card-topline">
          <span className="category-pill" title={item.primaryCategory}>
            {categoryLabel(item.primaryCategory)}
          </span>
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
          {hasReview ? item.reviewText : "짧은 리뷰 없음"}
        </p>
      </div>
      <div className="visit-log-card-stats">
        <span className="score-pill">
          <Star size={13} aria-hidden="true" />
          {item.rating ?? "-"}점
        </span>
        <span>
          <Camera size={13} aria-hidden="true" />
          {item.photoCount}장
        </span>
      </div>
    </Link>
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
