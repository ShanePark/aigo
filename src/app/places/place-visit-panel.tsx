"use client";

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Globe2,
  ImagePlus,
  Lock,
  LogIn,
  Maximize2,
  Search,
  Star,
  Trash2,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ChangeEvent, FormEvent, KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppModal, AppModalActions } from "../app-modal";
import { ConfirmDialog } from "../confirm-dialog";

type User = {
  displayName: string;
  email: string;
  id: string;
};

type MeResponse = {
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

type ConfirmAction = {
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  title: string;
  tone?: "danger" | "neutral";
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";
const MIN_VISIT_RATING = 0.5;
const MAX_VISIT_RATING = 5;
const RATING_STEP = 0.5;
const PUBLIC_VISITS_PER_PAGE = 5;

export function PlaceVisitPanel({ placeId, placeName }: { placeId: string; placeName: string }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [visits, setVisits] = useState<VisitsResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [reviewText, setReviewText] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [publicVisitPage, setPublicVisitPage] = useState(1);
  const [visitSearchQuery, setVisitSearchQuery] = useState("");
  const publicVisits = useMemo(() => visits?.items.filter((visit) => !visit.isMine) ?? [], [visits]);
  const normalizedVisitSearchQuery = normalizeListSearchText(visitSearchQuery);
  const filteredMyVisits = useMemo(() => {
    const myVisits = user ? visits?.myVisits ?? [] : [];
    if (!normalizedVisitSearchQuery) return myVisits;
    return myVisits.filter((visit) => visitSearchText(visit).includes(normalizedVisitSearchQuery));
  }, [normalizedVisitSearchQuery, user, visits]);
  const filteredPublicVisits = useMemo(() => {
    if (!normalizedVisitSearchQuery) return publicVisits;
    return publicVisits.filter((visit) => visitSearchText(visit).includes(normalizedVisitSearchQuery));
  }, [normalizedVisitSearchQuery, publicVisits]);
  const totalVisitCount = (user ? visits?.myVisits.length ?? 0 : 0) + publicVisits.length;
  const filteredVisitCount = filteredMyVisits.length + filteredPublicVisits.length;
  const publicVisitPageCount = Math.max(1, Math.ceil(filteredPublicVisits.length / PUBLIC_VISITS_PER_PAGE));
  const pagedPublicVisits = useMemo(
    () => filteredPublicVisits.slice((publicVisitPage - 1) * PUBLIC_VISITS_PER_PAGE, publicVisitPage * PUBLIC_VISITS_PER_PAGE),
    [publicVisitPage, filteredPublicVisits]
  );
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

  useEffect(() => {
    setPublicVisitPage(1);
  }, [placeId, visitSearchQuery]);

  useEffect(() => {
    setPublicVisitPage((currentPage) => Math.min(currentPage, publicVisitPageCount));
  }, [publicVisitPageCount]);

  return (
    <section className="place-visit-panel info-block full" aria-label={`${placeName} 방문 기록`}>
      <div className="place-visit-header">
        <div>
          <h2>
            <Star size={18} aria-hidden="true" />
            방문 기록
          </h2>
          <p>
            {visits?.summary.ratingCount
              ? `방문평가 ${visits.summary.averageRating?.toFixed(1) ?? "-"}점 · ${visits.summary.ratingCount}건`
              : "첫 방문 기록을 남겨보세요"}
          </p>
          {status ? <p className="place-visit-action-status">{status}</p> : null}
        </div>
        {totalVisitCount > 0 ? (
          <ListSearchField
            label="방문 기록 검색"
            onClear={() => setVisitSearchQuery("")}
            onChange={setVisitSearchQuery}
            placeholder="방문 기록 검색"
            value={visitSearchQuery}
          />
        ) : null}
        {visits?.summary.ratingCount || user ? (
          <div className="place-section-toolbar" aria-label="방문 평가 요약">
            <div className="trust-row place-visit-header-summary">
              {visits?.summary.ratingCount ? (
                <>
                  <span className="trust-badge neutral">공개리뷰 {visits.summary.publicReviewCount}</span>
                  <span className="trust-badge neutral">공개사진 {visits.summary.publicPhotoCount}</span>
                </>
              ) : null}
              {visits?.summary.latestVisitedOn ? (
                <span className="trust-badge neutral">최근 방문 {visits.summary.latestVisitedOn}</span>
              ) : null}
            </div>
            {user ? (
              <button
                className="primary-button place-visit-open-button"
                disabled={busy || loading}
                onClick={() => {
                  setStatus(null);
                  setVisitDialogOpen(true);
                }}
                type="button"
              >
                <Star size={16} aria-hidden="true" />
                방문 기록 등록
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="place-visit-login-card place-visit-loading-state">
          <div className="place-visit-login-copy">
            <strong>방문 기록을 불러오는 중입니다.</strong>
          </div>
        </div>
      ) : !user ? (
        <div className="place-visit-login-card">
          <div className="place-visit-login-copy">
            <strong>방문 기록은 로그인 후 남길 수 있어요.</strong>
          </div>
          <div className="place-visit-login-actions">
            <Link className="primary-button place-visit-login-button" href={`/login?next=${encodeURIComponent(pathname)}`}>
              <LogIn size={16} aria-hidden="true" />
              로그인하고 기록하기
            </Link>
            <Link className="place-visit-login-link" href="/">
              <Search size={16} aria-hidden="true" />
              다른 장소 찾기
            </Link>
          </div>
        </div>
      ) : null}

      <div className="place-visit-lists">
        {loading ? (
          <div className="place-visit-public-preview">
            <strong>공개 기록 미리보기</strong>
          </div>
        ) : totalVisitCount > 0 ? (
          <div className="place-visit-public-list">
            {filteredVisitCount > 0 ? (
              <div className="place-visit-summary-grid">
                {filteredMyVisits.map((visit) => (
                  <VisitSummary
                    key={visit.id}
                    visit={visit}
                    busy={busy}
                    onDelete={requestDeleteVisit}
                    onDeletePhoto={requestDeletePhoto}
                    onSave={saveVisitEdit}
                  />
                ))}
                {pagedPublicVisits.map((visit) => (
                  <VisitSummary key={visit.id} visit={visit} />
                ))}
              </div>
            ) : (
              <p className="place-visit-empty">검색어와 일치하는 방문 기록이 없습니다.</p>
            )}
            {filteredVisitCount > 0 ? (
              <div className="place-list-footer">
                <span className="place-list-count">
                  {filteredVisitCount}/{totalVisitCount}건
                </span>
                {publicVisitPageCount > 1 ? (
                  <div className="place-visit-pagination" aria-label="공개 방문 기록 페이지">
                    <button
                      className={`page-control ${publicVisitPage <= 1 ? "is-disabled" : ""}`}
                      disabled={publicVisitPage <= 1}
                      onClick={() => setPublicVisitPage((page) => Math.max(1, page - 1))}
                      type="button"
                    >
                      <ChevronLeft size={15} aria-hidden="true" />
                      이전
                    </button>
                    <span className="place-visit-page-status">
                      {publicVisitPage} / {publicVisitPageCount}
                    </span>
                    <button
                      className={`page-control ${publicVisitPage >= publicVisitPageCount ? "is-disabled" : ""}`}
                      disabled={publicVisitPage >= publicVisitPageCount}
                      onClick={() => setPublicVisitPage((page) => Math.min(publicVisitPageCount, page + 1))}
                      type="button"
                    >
                      다음
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="place-visit-public-preview">
            <strong>공개 기록 미리보기</strong>
            <p>아직 공개된 방문 기록이 없습니다.</p>
          </div>
        )}
      </div>
      <ConfirmDialog
        body={confirmAction?.body ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "확인"}
        disabled={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          if (!action) return;
          void action.onConfirm();
        }}
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        tone={confirmAction?.tone}
      />
      <AppModal
        disabled={busy}
        onClose={() => setVisitDialogOpen(false)}
        open={visitDialogOpen}
        title={`${placeName} 방문 기록 등록`}
      >
        <form className="place-visit-form is-modal" onSubmit={submitVisit}>
          <VisitRatingInput disabled={busy} label="평점" onChange={setRating} value={rating} />
          <VisitVisibilitySwitch disabled={busy} onChange={setVisibility} value={visibility} />
          <VisitReviewField disabled={busy} onChange={setReviewText} value={reviewText} />
          <VisitPhotoPicker disabled={busy} files={photoFiles} idPrefix={`visit-new-${placeId}`} onChange={setPhotoFiles} />

          <AppModalActions status={status}>
            <button className="app-modal-cancel" disabled={busy} onClick={() => setVisitDialogOpen(false)} type="button">
              취소
            </button>
            <button className="app-modal-submit" disabled={busy || loading} type="submit">
              {busy ? "저장 중" : "저장"}
            </button>
          </AppModalActions>
        </form>
      </AppModal>
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

      setStatus("저장했습니다.");
      resetVisitForm();
      setVisitDialogOpen(false);
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function resetVisitForm() {
    setRating(5);
    setVisibility("public");
    setReviewText("");
    setPhotoFiles([]);
  }

  async function saveVisitEdit(
    visit: VisitItem,
    nextVisit: { rating: number; reviewText: string; visibility: "public" | "private" },
    nextPhotos: File[]
  ) {
    if (busy) return false;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/visits/${visit.id}`, {
        body: JSON.stringify(nextVisit),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) throw new Error(await errorMessage(response));

      if (nextPhotos.length > 0) {
        const formData = new FormData();
        nextPhotos.forEach((file) => formData.append("photos", file));
        formData.set("visibility", nextVisit.visibility);
        const photoResponse = await fetch(`/api/visits/${visit.id}/photos`, {
          body: formData,
          credentials: "same-origin",
          method: "POST"
        });
        if (!photoResponse.ok) throw new Error(`기록은 수정됐지만 사진 저장에 실패했습니다. ${await errorMessage(photoResponse)}`);
      }

      setStatus("수정했습니다.");
      await refreshVisits();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "수정하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function requestDeleteVisit(visit: VisitItem) {
    setConfirmAction({
      body: "삭제하면 별점, 리뷰, 등록한 사진이 함께 사라집니다. 이 작업은 되돌릴 수 없습니다.",
      confirmLabel: "삭제",
      onConfirm: () => deleteVisit(visit),
      title: "이 방문 기록을 삭제할까요?",
      tone: "danger"
    });
  }

  async function deleteVisit(visit: VisitItem) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/visits/${visit.id}`, {
        credentials: "same-origin",
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setConfirmAction(null);
      setStatus("삭제했습니다.");
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function requestDeletePhoto(photo: VisitPhoto) {
    setConfirmAction({
      body: "이 사진만 방문 기록에서 삭제됩니다. 나머지 별점과 리뷰는 그대로 유지됩니다.",
      confirmLabel: "사진 삭제",
      onConfirm: () => deletePhoto(photo),
      title: "이 사진을 삭제할까요?",
      tone: "danger"
    });
  }

  async function deletePhoto(photo: VisitPhoto) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/visit-photos/${photo.id}`, {
        credentials: "same-origin",
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setConfirmAction(null);
      setStatus("사진을 삭제했습니다.");
      await refreshVisits();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "사진을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

}

function VisitSummary({
  busy,
  onDelete,
  onDeletePhoto,
  onSave,
  title,
  visit
}: {
  busy?: boolean;
  onDelete?: (visit: VisitItem) => void;
  onDeletePhoto?: (photo: VisitPhoto) => void;
  onSave?: (
    visit: VisitItem,
    nextVisit: { rating: number; reviewText: string; visibility: "public" | "private" },
    nextPhotos: File[]
  ) => Promise<boolean>;
  title?: string;
  visit: VisitItem;
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ index: number; photo: VisitPhoto } | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(visit.rating ?? 5);
  const [draftVisibility, setDraftVisibility] = useState<"public" | "private">(visit.visibility);
  const [draftReviewText, setDraftReviewText] = useState(visit.reviewText ?? "");
  const [draftPhotoFiles, setDraftPhotoFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!editDialogOpen) {
      setDraftRating(visit.rating ?? 5);
      setDraftVisibility(visit.visibility);
      setDraftReviewText(visit.reviewText ?? "");
      setDraftPhotoFiles([]);
    }
  }, [editDialogOpen, visit.rating, visit.reviewText, visit.visibility]);

  const canEdit = visit.isMine && onSave && onDelete;

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSave) return;
    const saved = await onSave(
      visit,
      {
        rating: draftRating,
        reviewText: draftReviewText,
        visibility: draftVisibility
      },
      draftPhotoFiles
    );
    if (saved) setEditDialogOpen(false);
  }

  return (
    <article className={`place-visit-summary ${visit.isMine ? "is-mine" : ""}`}>
      <div className="place-visit-summary-top">
        <div>
          {title ? <h3>{title}</h3> : null}
          <div className="place-visit-summary-head">
            <strong>{visit.rating === null ? "비공개" : `${formatRating(visit.rating)}/5`}</strong>
            <button className="summary-date-button" onClick={() => setDateDialogOpen(true)} type="button">
              <time dateTime={visit.visitedOn}>{formatRelativeDate(visit.visitedOn)}</time>
            </button>
            {visit.isMine ? <span className="mine-chip">내 방문 기록</span> : null}
            {visit.isRevisit ? <span>재방문</span> : null}
            {visit.visibility === "private" ? <span>비공개</span> : null}
          </div>
        </div>
        {canEdit ? (
          <div className="place-visit-summary-actions">
            <button disabled={busy || editDialogOpen} onClick={() => setEditDialogOpen(true)} type="button">
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
              <button className="place-visit-photo-open" onClick={() => setSelectedPhoto({ index, photo })} type="button">
                <Image alt={`방문 사진 ${index + 1}`} fill sizes="120px" src={photo.url} unoptimized />
                <span aria-hidden="true">
                  <Maximize2 size={14} />
                </span>
              </button>
              {visit.isMine && onDeletePhoto ? (
                <button
                  className="place-visit-photo-delete"
                  disabled={busy}
                  onClick={() => onDeletePhoto(photo)}
                  type="button"
                  aria-label={`방문 사진 ${index + 1} 삭제`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
      <AppModal onClose={() => setDateDialogOpen(false)} open={dateDialogOpen} title="방문 날짜">
        <div className="app-modal-copy">
          <p>{formatExactVisitDate(visit.visitedOn)}</p>
        </div>
      </AppModal>
      <AppModal
        disabled={busy}
        onClose={() => setEditDialogOpen(false)}
        open={editDialogOpen}
        title="방문 기록 수정"
      >
        <form className="place-visit-form is-modal" onSubmit={submitEdit}>
          <VisitRatingInput disabled={busy} label="평점" onChange={setDraftRating} value={draftRating} />
          <VisitVisibilitySwitch disabled={busy} onChange={setDraftVisibility} value={draftVisibility} />
          <VisitReviewField disabled={busy} onChange={setDraftReviewText} value={draftReviewText} />
          <VisitPhotoPicker disabled={busy} files={draftPhotoFiles} idPrefix={`visit-edit-${visit.id}`} onChange={setDraftPhotoFiles} />
          <AppModalActions>
            <button className="app-modal-cancel" disabled={busy} onClick={() => setEditDialogOpen(false)} type="button">
              취소
            </button>
            <button className="app-modal-submit" disabled={busy} type="submit">
              {busy ? "저장 중" : "저장"}
            </button>
          </AppModalActions>
        </form>
      </AppModal>
      <AppModal
        disabled={busy}
        onClose={() => setSelectedPhoto(null)}
        open={selectedPhoto !== null}
        size="media"
        title="방문 사진"
      >
        {selectedPhoto ? (
          <figure className="place-visit-photo-viewer">
            <Image alt={`방문 사진 ${selectedPhoto.index + 1} 크게 보기`} fill sizes="min(92vw, 960px)" src={selectedPhoto.photo.url} unoptimized />
          </figure>
        ) : null}
      </AppModal>
    </article>
  );
}

function VisitRatingInput({
  disabled,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const activeRating = hoverRating ?? value;

  function handlePointer(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
    const nextRating = handleRatingFromPointer(event);
    setHoverRating(nextRating);
    if (event.type === "pointerdown") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onChange(nextRating);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (disabled) return;
    const keySteps: Record<string, number> = {
      ArrowDown: -RATING_STEP,
      ArrowLeft: -RATING_STEP,
      ArrowRight: RATING_STEP,
      ArrowUp: RATING_STEP,
      End: MAX_VISIT_RATING - value,
      Home: MIN_VISIT_RATING - value
    };
    const step = keySteps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setHoverRating(null);
    onChange(clampRating(value + step));
  }

  return (
    <fieldset className="place-visit-rating">
      <legend>{label}</legend>
      <div className="place-visit-rating-control">
        <div
          aria-label="방문 평점"
          aria-valuemax={MAX_VISIT_RATING}
          aria-valuemin={MIN_VISIT_RATING}
          aria-valuenow={value}
          aria-valuetext={`${formatRating(value)}점`}
          className={`place-visit-stars ${disabled ? "is-disabled" : ""}`}
          onBlur={() => setHoverRating(null)}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setHoverRating(null)}
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          role="slider"
          style={{ "--rating-fill": `${(activeRating / MAX_VISIT_RATING) * 100}%` } as CSSProperties}
          tabIndex={disabled ? -1 : 0}
        >
          <span className="place-visit-star-row" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={30} />
            ))}
          </span>
          <span className="place-visit-star-row place-visit-star-fill" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={30} />
            ))}
          </span>
        </div>
        <output className="place-visit-rating-value" aria-live="polite">
          {formatRating(activeRating)}
        </output>
      </div>
      <p className="place-visit-rating-label">{formatRating(value)}점 선택됨</p>
    </fieldset>
  );
}

function VisitVisibilitySwitch({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: "public" | "private") => void;
  value: "public" | "private";
}) {
  return (
    <fieldset className="place-visit-visibility">
      <legend>공개 범위</legend>
      <label className="place-visit-switch">
        <input
          checked={value === "public"}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked ? "public" : "private")}
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true">
          <Globe2 size={14} />
          <Lock size={14} />
        </span>
        <strong>{value === "public" ? "공개" : "비공개"}</strong>
      </label>
    </fieldset>
  );
}

function VisitReviewField({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="place-visit-field place-visit-review">
      <span>
        짧은 리뷰
        <small>{value.length}/2000</small>
      </span>
      <textarea
        disabled={disabled}
        maxLength={2000}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="다시 가고 싶은 이유, 아이 반응, 부모 입장에서 좋았던 점"
      />
    </label>
  );
}

function VisitPhotoPicker({
  disabled,
  files,
  idPrefix,
  onChange
}: {
  disabled?: boolean;
  files: File[];
  idPrefix: string;
  onChange: (files: File[]) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoHelpId = `${idPrefix}-photo-help`;
  const selectedPhotoId = `${idPrefix}-photo-selected`;
  const photoPreviews = useMemo(
    () =>
      files.map((file, index) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        url: URL.createObjectURL(file)
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.currentTarget.files ?? []);
    onChange([...files, ...nextFiles]);
    event.currentTarget.value = "";
  }

  function removePhotoFile(index: number) {
    onChange(files.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="place-visit-field place-visit-photo">
      <div className="place-visit-photo-label">
        <span>
          <Camera size={15} aria-hidden="true" />
          사진
        </span>
        <small id={photoHelpId}>여러 장 선택 가능 · 장당 10MB 이하</small>
      </div>
      <div className={`place-visit-upload-card ${files.length > 0 ? "has-file" : ""}`}>
        <button
          aria-describedby={files.length > 0 ? selectedPhotoId : photoHelpId}
          className="place-visit-upload-button"
          disabled={disabled}
          onClick={() => photoInputRef.current?.click()}
          type="button"
        >
          <ImagePlus size={18} aria-hidden="true" />
          <span>{files.length > 0 ? "사진 더 추가" : "사진 추가"}</span>
        </button>
        {photoPreviews.length > 0 ? (
          <div className="place-visit-selected-photos" id={selectedPhotoId}>
            {photoPreviews.map((preview, index) => (
              <figure className="place-visit-selected-photo" key={preview.id}>
                <Image alt={`선택한 방문 사진 ${index + 1}`} fill sizes="96px" src={preview.url} unoptimized />
                <button aria-label={`선택한 사진 ${index + 1} 제거`} disabled={disabled} onClick={() => removePhotoFile(index)} type="button">
                  <X size={14} aria-hidden="true" />
                </button>
              </figure>
            ))}
          </div>
        ) : null}
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
  );
}

function ListSearchField({
  label,
  onChange,
  onClear,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="place-list-search">
      <label>
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </label>
      {value ? (
        <button aria-label={`${label} 초기화`} onClick={onClear} type="button">
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function visitSearchText(visit: VisitItem) {
  return normalizeListSearchText(
    [
      visit.reviewText,
      visit.visitedOn,
      formatRelativeDate(visit.visitedOn),
      visit.isMine ? "내 기록 내가 쓴 기록" : "",
      visit.isPrivatePlaceholder ? "비공개 리뷰" : "",
      visit.visibility === "private" ? "비공개 private" : "공개 public",
      visit.isRevisit ? "재방문 다시 방문" : "첫방문 첫 방문",
      visit.photoCount > 0 ? `사진 ${visit.photoCount}장 사진 있음` : "사진 없음",
      visit.rating === null ? "별점 비공개" : `별점 ${formatRating(visit.rating)}점 평점 ${formatRating(visit.rating)}점`
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizeListSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
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

function formatRelativeDate(value: string) {
  const date = parseVisitDate(value);
  if (!date) return value;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "오늘";
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  if (diffMs < hourMs) return "방금 전";
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}시간 전`;
  const days = Math.floor(diffMs / dayMs);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}달 전`;
  return `${Math.floor(months / 12)}년 전`;
}

function formatExactVisitDate(value: string) {
  const date = parseVisitDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function parseVisitDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
