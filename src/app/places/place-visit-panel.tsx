"use client";

import { Camera, CheckCircle2, Globe2, Lock, Star } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type User = {
  displayName: string;
  email: string;
  id: string;
};

type MeResponse = {
  devLoginEnabled: boolean;
  user: User | null;
};

type VisitItem = {
  id: string;
  placeId: string;
  visitedOn: string;
  rating: number | null;
  reviewText: string | null;
  visibility: "public" | "private";
  isRevisit: boolean | null;
  isMine: boolean;
  isPrivatePlaceholder: boolean;
  displayName: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
};

type VisitsResponse = {
  summary: {
    averageRating: number | null;
    ratingCount: number;
  };
  hasVisited: boolean;
  myVisits: VisitItem[];
  items: VisitItem[];
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";

export function PlaceVisitPanel({ placeId, placeName }: { placeId: string; placeName: string }) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [visits, setVisits] = useState<VisitsResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [reviewText, setReviewText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const myLatestVisit = visits?.myVisits[0] ?? null;
  const publicVisits = useMemo(() => visits?.items.filter((visit) => !visit.isMine).slice(0, 3) ?? [], [visits]);
  const refreshVisits = useCallback(async () => {
    const response = await fetch(`/api/places/${placeId}/visits`, { credentials: "same-origin" });
    if (!response.ok) return;
    setVisits((await response.json()) as VisitsResponse);
  }, [placeId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [meResponse, visitsResponse] = await Promise.all([
          fetch("/api/me", { credentials: "same-origin" }),
          fetch(`/api/places/${placeId}/visits`, { credentials: "same-origin" })
        ]);
        const me = meResponse.ok ? ((await meResponse.json()) as MeResponse) : null;
        const nextVisits = visitsResponse.ok ? ((await visitsResponse.json()) as VisitsResponse) : null;
        if (!active) return;
        setUser(me?.user ?? null);
        setVisits(nextVisits);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    function handleAuthChange(event: Event) {
      const detail = (event as CustomEvent<{ user: User | null }>).detail;
      setUser(detail?.user ?? null);
      void refreshVisits();
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, [placeId, refreshVisits]);

  return (
    <section className="place-visit-panel info-block full" aria-label={`${placeName} 방문 기록`}>
      <div className="place-visit-header">
        <div>
          <h2>
            <Star size={18} aria-hidden="true" />
            방문했어요
          </h2>
          <p>
            {visits?.summary.ratingCount
              ? `가족 평가 ${visits.summary.averageRating?.toFixed(1) ?? "-"}점 · ${visits.summary.ratingCount}건`
              : "첫 방문 기록을 남겨보세요"}
          </p>
        </div>
        {myLatestVisit ? (
          <span className="place-visit-owned">
            <CheckCircle2 size={15} aria-hidden="true" />
            내 기록 있음
          </span>
        ) : null}
      </div>

      <form className="place-visit-form" onSubmit={submitVisit}>
        <fieldset className="place-visit-rating">
          <legend>평점</legend>
          <div className="place-visit-stars" aria-label={`${rating}점 선택됨`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                aria-pressed={rating === value}
                className={value <= rating ? "is-active" : ""}
                key={value}
                onClick={() => setRating(value)}
                type="button"
              >
                <Star size={18} aria-hidden="true" />
                <span>{value}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="place-visit-visibility">
          <legend>공개 범위</legend>
          <div>
            <button className={visibility === "public" ? "is-active" : ""} onClick={() => setVisibility("public")} type="button">
              <Globe2 size={15} aria-hidden="true" />
              공개
            </button>
            <button className={visibility === "private" ? "is-active" : ""} onClick={() => setVisibility("private")} type="button">
              <Lock size={15} aria-hidden="true" />
              비공개
            </button>
          </div>
        </fieldset>

        <label className="place-visit-field place-visit-review">
          <span>짧은 리뷰</span>
          <textarea
            maxLength={2000}
            rows={4}
            value={reviewText}
            onChange={(event) => setReviewText(event.currentTarget.value)}
            placeholder="다시 가고 싶은 이유, 아이 반응, 부모 입장에서 좋았던 점"
          />
        </label>

        <label className="place-visit-field place-visit-photo">
          <span>
            <Camera size={15} aria-hidden="true" />
            사진
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            ref={photoInputRef}
            type="file"
            onChange={(event) => setPhotoFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>

        <div className="place-visit-submit">
          <button className="primary-button" disabled={busy || loading || !user} type="submit">
            {busy ? "저장 중" : "방문 기록 저장"}
          </button>
          {status ? <p>{status}</p> : !user ? <p>dev 로그인 후 기록할 수 있습니다.</p> : null}
        </div>
      </form>

      <div className="place-visit-lists">
        {myLatestVisit ? (
          <VisitSummary title="내 최근 기록" visit={myLatestVisit} />
        ) : (
          <div className="place-visit-empty">아직 내 방문 기록이 없습니다.</div>
        )}
        {publicVisits.length > 0 ? (
          <div className="place-visit-public-list">
            <h3>공개 기록</h3>
            {publicVisits.map((visit) => (
              <VisitSummary key={visit.id} visit={visit} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );

  async function submitVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/places/${placeId}/visits`, {
        body: JSON.stringify({
          rating,
          reviewText,
          visibility
        }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const body = (await response.json()) as { item: VisitItem };

      if (photoFile) {
        const formData = new FormData();
        formData.set("photo", photoFile);
        formData.set("visibility", visibility);
        const photoResponse = await fetch(`/api/visits/${body.item.id}/photos`, {
          body: formData,
          credentials: "same-origin",
          method: "POST"
        });
        if (!photoResponse.ok) throw new Error(`방문은 저장됐지만 사진 저장에 실패했습니다. ${await errorMessage(photoResponse)}`);
      }

      setStatus("저장했습니다.");
      setReviewText("");
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

}

function VisitSummary({ title, visit }: { title?: string; visit: VisitItem }) {
  return (
    <article className="place-visit-summary">
      {title ? <h3>{title}</h3> : null}
      <div className="place-visit-summary-head">
        <strong>{visit.rating === null ? "비공개" : `${visit.rating}/5`}</strong>
        <span>{visit.visitedOn}</span>
        {visit.isRevisit ? <span>재방문</span> : null}
        {visit.visibility === "private" ? <span>비공개</span> : null}
        {visit.photoCount > 0 ? <span>사진 {visit.photoCount}</span> : null}
      </div>
      {visit.reviewText ? <p>{visit.reviewText}</p> : visit.isPrivatePlaceholder ? <p>비공개 리뷰입니다.</p> : null}
    </article>
  );
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "요청 실패";
  } catch {
    return "요청 실패";
  }
}
