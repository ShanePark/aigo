"use client";

import { Camera, CheckCircle2, Edit3, Globe2, ImagePlus, Lock, LogIn, Search, Star, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ChangeEvent, FormEvent, KeyboardEvent, PointerEvent } from "react";
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
  photos: VisitPhoto[];
  createdAt: string;
  updatedAt: string;
};

type VisitPhoto = {
  id: string;
  visitId: string;
  placeId: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  visibility: "public" | "private";
  createdAt: string;
};

type VisitsResponse = {
  summary: {
    averageRating: number | null;
    latestVisitedOn: string | null;
    publicPhotoCount: number;
    publicReviewCount: number;
    ratingCount: number;
  };
  hasVisited: boolean;
  myVisits: VisitItem[];
  items: VisitItem[];
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";
const MIN_VISIT_RATING = 0.5;
const MAX_VISIT_RATING = 5;
const RATING_STEP = 0.5;

export function PlaceVisitPanel({ placeId, placeName }: { placeId: string; placeName: string }) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [visits, setVisits] = useState<VisitsResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [reviewText, setReviewText] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [editingVisit, setEditingVisit] = useState<VisitItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const myLatestVisit = user ? visits?.myVisits[0] ?? null : null;
  const publicVisits = useMemo(() => visits?.items.filter((visit) => !visit.isMine) ?? [], [visits]);
  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file, index) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        url: URL.createObjectURL(file)
      })),
    [photoFiles]
  );
  const photoHelpId = `visit-photo-help-${placeId}`;
  const selectedPhotoId = `visit-photo-selected-${placeId}`;
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
        setDevLoginEnabled(me?.devLoginEnabled ?? false);
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

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

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
              ? `방문평가 ${visits.summary.averageRating?.toFixed(1) ?? "-"}점 · ${visits.summary.ratingCount}건`
              : "첫 방문 기록을 남겨보세요"}
          </p>
          {visits?.summary.ratingCount ? (
            <div className="trust-row place-visit-header-summary" aria-label="방문 평가 요약">
              <span className="trust-badge neutral">공개리뷰 {visits.summary.publicReviewCount}</span>
              <span className="trust-badge neutral">공개사진 {visits.summary.publicPhotoCount}</span>
              {visits.summary.latestVisitedOn ? (
                <span className="trust-badge neutral">최근 방문 {visits.summary.latestVisitedOn}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {myLatestVisit ? (
          <span className="place-visit-owned">
            <CheckCircle2 size={15} aria-hidden="true" />
            내 기록 있음
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="place-visit-login-card place-visit-loading-state">
          <div className="place-visit-login-copy">
            <strong>방문 기록을 불러오는 중입니다.</strong>
            <p>로그인 상태와 공개 방문 기록을 확인하고 있어요.</p>
          </div>
        </div>
      ) : user ? (
        <form className="place-visit-form" onSubmit={submitVisit}>
          <fieldset className="place-visit-rating">
            <legend>평점</legend>
            <div className="place-visit-rating-control">
              <div
                aria-label="방문 평점"
                aria-valuemax={MAX_VISIT_RATING}
                aria-valuemin={MIN_VISIT_RATING}
                aria-valuenow={rating}
                aria-valuetext={`${formatRating(rating)}점`}
                className={`place-visit-stars ${busy ? "is-disabled" : ""}`}
                onBlur={() => setHoverRating(null)}
                onKeyDown={handleRatingKeyDown}
                onMouseLeave={() => setHoverRating(null)}
                onPointerDown={handleRatingPointer}
                onPointerMove={handleRatingPointer}
                role="slider"
                style={{ "--rating-fill": `${((hoverRating ?? rating) / MAX_VISIT_RATING) * 100}%` } as CSSProperties}
                tabIndex={busy ? -1 : 0}
              >
                <span className="place-visit-star-row" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} size={30} />
                  ))}
                </span>
                <span className="place-visit-star-row place-visit-star-fill" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} size={30} />
                  ))}
                </span>
              </div>
              <output className="place-visit-rating-value" aria-live="polite">
                {formatRating(hoverRating ?? rating)}
              </output>
            </div>
            <p className="place-visit-rating-label">{formatRating(rating)}점 선택됨</p>
          </fieldset>

          <fieldset className="place-visit-visibility">
            <legend>공개 범위</legend>
            <label className="place-visit-switch">
              <input
                checked={visibility === "public"}
                disabled={busy}
                onChange={(event) => setVisibility(event.currentTarget.checked ? "public" : "private")}
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true">
                <Globe2 size={14} />
                <Lock size={14} />
              </span>
              <strong>{visibility === "public" ? "공개" : "비공개"}</strong>
            </label>
          </fieldset>

          <label className="place-visit-field place-visit-review">
            <span>
              짧은 리뷰
              <small>{reviewText.length}/2000</small>
            </span>
            <textarea
              disabled={busy}
              maxLength={2000}
              rows={4}
              value={reviewText}
              onChange={(event) => setReviewText(event.currentTarget.value)}
              placeholder="다시 가고 싶은 이유, 아이 반응, 부모 입장에서 좋았던 점"
            />
          </label>

          <div className="place-visit-field place-visit-photo">
            <div className="place-visit-photo-label">
              <span>
                <Camera size={15} aria-hidden="true" />
                사진
              </span>
              <small id={photoHelpId}>여러 장 선택 가능 · 장당 10MB 이하</small>
            </div>
            <div className={`place-visit-upload-card ${photoFiles.length > 0 ? "has-file" : ""}`}>
              <button
                aria-describedby={photoFiles.length > 0 ? selectedPhotoId : photoHelpId}
                className="place-visit-upload-button"
                disabled={busy}
                onClick={() => photoInputRef.current?.click()}
                type="button"
              >
                <ImagePlus size={18} aria-hidden="true" />
                <span>{photoFiles.length > 0 ? "사진 더 추가" : "사진 추가"}</span>
              </button>
              {photoPreviews.length > 0 ? (
                <div className="place-visit-selected-photos" id={selectedPhotoId}>
                  {photoPreviews.map((preview, index) => (
                    <figure className="place-visit-selected-photo" key={preview.id}>
                      <Image alt={`선택한 방문 사진 ${index + 1}`} fill sizes="96px" src={preview.url} unoptimized />
                      <button aria-label={`선택한 사진 ${index + 1} 제거`} disabled={busy} onClick={() => removePhotoFile(index)} type="button">
                        <X size={14} aria-hidden="true" />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <p>사진을 선택하면 이곳에 미리보기가 표시됩니다.</p>
              )}
            </div>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-hidden="true"
              className="place-visit-file-input"
              multiple
              ref={photoInputRef}
              tabIndex={-1}
              type="file"
              onChange={handlePhotoChange}
            />
          </div>

          <div className="place-visit-submit">
            <button className="primary-button" disabled={busy || loading} type="submit">
              {busy ? "저장 중" : editingVisit ? "수정 저장" : "방문 기록 저장"}
            </button>
            {editingVisit ? (
              <button className="place-visit-cancel-edit" disabled={busy} onClick={resetVisitForm} type="button">
                취소
              </button>
            ) : null}
            {status ? <p>{status}</p> : null}
          </div>
        </form>
      ) : (
        <div className="place-visit-login-card">
          <div className="place-visit-login-copy">
            <strong>방문 기록은 로그인 후 남길 수 있어요.</strong>
            <p>
              별점과 짧은 리뷰를 저장하면 나중에 다시 가고 싶은 장소를 찾기 쉬워집니다.
              공개 기록은 다른 가족도 참고할 수 있고, 비공개 기록은 평균 별점에만 반영돼요.
            </p>
          </div>
          <div className="place-visit-login-actions">
            {devLoginEnabled ? (
              <button
                className="primary-button place-visit-login-button"
                disabled={authBusy || loading}
                onClick={loginFromPanel}
                type="button"
              >
                <LogIn size={16} aria-hidden="true" />
                {authBusy ? "로그인 중" : "dev 로그인하고 기록하기"}
              </button>
            ) : null}
            <Link className="place-visit-login-link" href="/">
              <Search size={16} aria-hidden="true" />
              다른 장소 찾기
            </Link>
          </div>
          {authStatus ? (
            <p className="place-visit-auth-status" role="alert">
              {authStatus}
            </p>
          ) : null}
        </div>
      )}

      <div className="place-visit-lists">
        {loading ? (
          <div className="place-visit-public-preview">
            <strong>공개 기록 미리보기</strong>
            <p>공개 방문 기록을 불러오는 중입니다.</p>
          </div>
        ) : user ? (
          visits?.myVisits.length ? (
            <div className="place-visit-public-list">
              <h3>내 방문 기록</h3>
              {visits.myVisits.map((visit) => (
                <VisitSummary
                  key={visit.id}
                  visit={visit}
                  busy={busy}
                  onDelete={deleteVisit}
                  onDeletePhoto={deletePhoto}
                  onEdit={startEditVisit}
                />
              ))}
            </div>
          ) : (
            <div className="place-visit-empty">아직 내 방문 기록이 없습니다.</div>
          )
        ) : (
          <div className="place-visit-public-preview">
            <strong>공개 기록 미리보기</strong>
            <p>
              {publicVisits.length > 0
                ? "로그인하지 않아도 공개 리뷰는 먼저 살펴볼 수 있어요."
                : "아직 공개된 방문 기록이 없습니다."}
            </p>
          </div>
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
      const response = await fetch(editingVisit ? `/api/visits/${editingVisit.id}` : `/api/places/${placeId}/visits`, {
        body: JSON.stringify({
          rating,
          reviewText,
          visibility
        }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: editingVisit ? "PATCH" : "POST"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const body = (await response.json()) as { item: VisitItem };

      if (photoFiles.length > 0) {
        const formData = new FormData();
        photoFiles.forEach((file) => formData.append("photos", file));
        formData.set("visibility", visibility);
        const photoResponse = await fetch(`/api/visits/${body.item.id}/photos`, {
          body: formData,
          credentials: "same-origin",
          method: "POST"
        });
        if (!photoResponse.ok) throw new Error(`방문은 저장됐지만 사진 저장에 실패했습니다. ${await errorMessage(photoResponse)}`);
      }

      setStatus(editingVisit ? "수정했습니다." : "저장했습니다.");
      resetVisitForm();
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function loginFromPanel() {
    if (!devLoginEnabled || authBusy) return;

    setAuthBusy(true);
    setAuthStatus(null);
    try {
      const response = await fetch("/api/auth/dev-login", {
        credentials: "same-origin",
        method: "POST"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const body = (await response.json()) as { user: User };
      setUser(body.user);
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: body.user } }));
      router.refresh();
      await refreshVisits();
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? `로그인하지 못했습니다. ${error.message}` : "로그인하지 못했습니다."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.currentTarget.files ?? []);
    setPhotoFiles((current) => [...current, ...nextFiles]);
    event.currentTarget.value = "";
  }

  function removePhotoFile(index: number) {
    setPhotoFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function resetVisitForm() {
    setEditingVisit(null);
    setRating(5);
    setHoverRating(null);
    setVisibility("public");
    setReviewText("");
    setPhotoFiles([]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function startEditVisit(visit: VisitItem) {
    setEditingVisit(visit);
    setRating(visit.rating ?? 5);
    setHoverRating(null);
    setVisibility(visit.visibility);
    setReviewText(visit.reviewText ?? "");
    setPhotoFiles([]);
  }

  async function deleteVisit(visit: VisitItem) {
    if (busy || !window.confirm("이 방문 기록을 삭제할까요?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/visits/${visit.id}`, {
        credentials: "same-origin",
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      if (editingVisit?.id === visit.id) resetVisitForm();
      setStatus("삭제했습니다.");
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photo: VisitPhoto) {
    if (busy || !window.confirm("이 사진을 삭제할까요?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/visit-photos/${photo.id}`, {
        credentials: "same-origin",
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setStatus("사진을 삭제했습니다.");
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "사진을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function handleRatingPointer(event: PointerEvent<HTMLElement>) {
    if (busy) return;
    const nextRating = handleRatingFromPointer(event);
    setHoverRating(nextRating);
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setRating(nextRating);
    }
  }

  function handleRatingKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (busy) return;
    const keySteps: Record<string, number> = {
      ArrowDown: -RATING_STEP,
      ArrowLeft: -RATING_STEP,
      ArrowRight: RATING_STEP,
      ArrowUp: RATING_STEP,
      End: MAX_VISIT_RATING - rating,
      Home: MIN_VISIT_RATING - rating
    };
    const step = keySteps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setHoverRating(null);
    setRating(clampRating(rating + step));
  }

}

function VisitSummary({
  busy,
  onDelete,
  onDeletePhoto,
  onEdit,
  title,
  visit
}: {
  busy?: boolean;
  onDelete?: (visit: VisitItem) => void;
  onDeletePhoto?: (photo: VisitPhoto) => void;
  onEdit?: (visit: VisitItem) => void;
  title?: string;
  visit: VisitItem;
}) {
  return (
    <article className="place-visit-summary">
      <div className="place-visit-summary-top">
        <div>
          {title ? <h3>{title}</h3> : null}
          <div className="place-visit-summary-head">
            <strong>{visit.rating === null ? "비공개" : `${formatRating(visit.rating)}/5`}</strong>
            <span>{visit.visitedOn}</span>
            {visit.displayName && !visit.isMine ? <span>{visit.displayName}</span> : null}
            {visit.isRevisit ? <span>재방문</span> : null}
            {visit.visibility === "private" ? <span>비공개</span> : null}
            {visit.photoCount > 0 ? <span>사진 {visit.photoCount}</span> : null}
          </div>
        </div>
        {visit.isMine && onEdit && onDelete ? (
          <div className="place-visit-summary-actions">
            <button disabled={busy} onClick={() => onEdit(visit)} type="button">
              <Edit3 size={14} aria-hidden="true" />
              수정
            </button>
            <button disabled={busy} onClick={() => onDelete(visit)} type="button">
              <Trash2 size={14} aria-hidden="true" />
              삭제
            </button>
          </div>
        ) : null}
      </div>
      {visit.reviewText ? <p>{visit.reviewText}</p> : visit.isPrivatePlaceholder ? <p>비공개 리뷰입니다.</p> : null}
      {visit.photos.length > 0 ? (
        <div className="place-visit-photo-grid" aria-label="방문 사진">
          {visit.photos.map((photo, index) => (
            <figure className="place-visit-photo-thumb" key={photo.id}>
              <Image alt={`방문 사진 ${index + 1}`} fill sizes="120px" src={photo.url} unoptimized />
              {visit.isMine && onDeletePhoto ? (
                <button disabled={busy} onClick={() => onDeletePhoto(photo)} type="button" aria-label={`방문 사진 ${index + 1} 삭제`}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
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

function handleRatingFromPointer(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const position = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const rawRating = (position / rect.width) * MAX_VISIT_RATING;
  return clampRating(Math.ceil(rawRating / RATING_STEP) * RATING_STEP);
}

function clampRating(value: number) {
  return Math.min(MAX_VISIT_RATING, Math.max(MIN_VISIT_RATING, Number(value.toFixed(1))));
}

function formatRating(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
