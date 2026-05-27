"use client";

import { Edit3, LogIn, MessageSquareText, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppModal, AppModalActions } from "@/app/app-modal";
import { ConfirmDialog } from "@/app/confirm-dialog";

type User = {
  displayName: string;
  email: string;
  id: string;
};

type MeResponse = {
  user: User | null;
};

type PublicMemoItem = {
  id: string;
  userId: string;
  placeId: string;
  body: string;
  displayName: string | null;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
};

type PublicMemosResponse = {
  items: PublicMemoItem[];
};

type ConfirmAction = {
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  title: string;
  tone?: "danger" | "neutral";
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";
const MEMO_MAX_LENGTH = 1000;

export function PlacePublicMemoPanel({ placeId, placeName }: { placeId: string; placeName: string }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [memos, setMemos] = useState<PublicMemosResponse | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);
  const [memoSearchQuery, setMemoSearchQuery] = useState("");
  const myMemo = useMemo(() => memos?.items.find((memo) => memo.isMine) ?? null, [memos]);
  const publicMemos = useMemo(() => memos?.items ?? [], [memos]);
  const normalizedMemoSearchQuery = normalizeListSearchText(memoSearchQuery);
  const filteredPublicMemos = useMemo(() => {
    if (!normalizedMemoSearchQuery) return publicMemos;
    return publicMemos.filter((memo) => memoSearchText(memo).includes(normalizedMemoSearchQuery));
  }, [normalizedMemoSearchQuery, publicMemos]);

  const refreshMemos = useCallback(async () => {
    const response = await fetch(`/api/places/${placeId}/memos`, { credentials: "same-origin" });
    if (!response.ok) return;
    setMemos((await response.json()) as PublicMemosResponse);
  }, [placeId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [meResponse, memosResponse] = await Promise.all([
          fetch("/api/me", { credentials: "same-origin" }),
          fetch(`/api/places/${placeId}/memos`, { credentials: "same-origin" })
        ]);
        const me = meResponse.ok ? ((await meResponse.json()) as MeResponse) : null;
        const nextMemos = memosResponse.ok ? ((await memosResponse.json()) as PublicMemosResponse) : null;
        if (!active) return;
        setUser(me?.user ?? null);
        setMemos(nextMemos);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    function handleAuthChange(event: Event) {
      const detail = (event as CustomEvent<{ user: User | null }>).detail;
      setUser(detail?.user ?? null);
      void refreshMemos();
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, [placeId, refreshMemos]);

  return (
    <section className="place-memo-panel info-block full" aria-label={`${placeName} 장소 이용 팁`}>
      <div className="place-memo-header">
        <div>
          <h2>
            <MessageSquareText size={18} aria-hidden="true" />
            장소 이용 팁
          </h2>
          {status ? <p className="place-memo-action-status">{status}</p> : null}
        </div>
        {publicMemos.length > 0 ? (
          <ListSearchField
            label="장소 이용 팁 검색"
            onClear={() => setMemoSearchQuery("")}
            onChange={setMemoSearchQuery}
            placeholder="장소 이용 팁 검색"
            value={memoSearchQuery}
          />
        ) : null}
        {user && !myMemo ? (
          <div className="place-section-toolbar place-memo-header-summary" aria-label="장소 이용 팁 작업">
            <button
              className="primary-button place-memo-open-button"
              disabled={busy}
              onClick={() => {
                setStatus(null);
                setMemoDialogOpen(true);
              }}
              type="button"
            >
              <Edit3 size={16} aria-hidden="true" />
              장소 팁 등록
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="place-memo-login-card">
          <div className="place-memo-login-copy">
            <strong>장소 이용 팁을 불러오는 중입니다.</strong>
          </div>
        </div>
      ) : !user ? (
        <div className="place-memo-login-card">
          <div className="place-memo-login-copy">
            <strong>공개 팁은 로그인 후 남길 수 있어요.</strong>
          </div>
          <div className="place-memo-login-actions">
            <Link className="primary-button place-memo-login-button" href={`/login?next=${encodeURIComponent(pathname)}`}>
              <LogIn size={16} aria-hidden="true" />
              로그인하고 팁 남기기
            </Link>
            <Link className="place-memo-login-link" href="/">
              <Search size={16} aria-hidden="true" />
              다른 장소 찾기
            </Link>
          </div>
        </div>
      ) : null}

      <div className="place-memo-list">
        {loading ? (
          <p className="place-memo-empty">공개 팁을 불러오는 중입니다.</p>
        ) : filteredPublicMemos.length > 0 ? (
          <div className="place-memo-summary-grid">
            {filteredPublicMemos.map((memo) => (
              <MemoSummary
                busy={busy}
                key={memo.id}
                memo={memo}
                onDelete={memo.isMine ? requestDeleteMemo : undefined}
                onSave={memo.isMine ? saveMemoEdit : undefined}
              />
            ))}
          </div>
        ) : publicMemos.length > 0 ? (
          <p className="place-memo-empty">검색어와 일치하는 장소 이용 팁이 없습니다.</p>
        ) : (
          <p className="place-memo-empty">아직 공개된 장소 이용 팁이 없습니다.</p>
        )}
        {publicMemos.length > 0 ? (
          <div className="place-list-footer">
            <span className="place-list-count">
              {filteredPublicMemos.length}/{publicMemos.length}개
            </span>
          </div>
        ) : null}
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
        onClose={() => setMemoDialogOpen(false)}
        open={memoDialogOpen}
        title="장소 이용 팁 등록"
      >
        <form className="place-memo-form is-modal" onSubmit={submitMemo}>
          <MemoBodyField disabled={busy} onChange={setBody} value={body} />
          <AppModalActions status={status}>
            <button className="app-modal-cancel" disabled={busy} onClick={() => setMemoDialogOpen(false)} type="button">
              취소
            </button>
            <button className="app-modal-submit" disabled={busy || body.trim().length === 0} type="submit">
              {busy ? "저장 중" : "저장"}
            </button>
          </AppModalActions>
        </form>
      </AppModal>
    </section>
  );

  async function submitMemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/places/${placeId}/memos`, {
        body: JSON.stringify({ body }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setBody("");
      setStatus("저장했습니다.");
      setMemoDialogOpen(false);
      await refreshMemos();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemoEdit(memo: PublicMemoItem, nextBody: string) {
    if (busy) return false;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/place-memos/${memo.id}`, {
        body: JSON.stringify({ body: nextBody }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setStatus("수정했습니다.");
      await refreshMemos();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "수정하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function requestDeleteMemo(memo: PublicMemoItem) {
    setConfirmAction({
      body: "삭제하면 이 장소 이용 팁이 공개 목록에서 사라집니다. 방문 기록과 별점은 바뀌지 않습니다.",
      confirmLabel: "삭제",
      onConfirm: () => deleteMemo(memo),
      title: "이 장소 이용 팁을 삭제할까요?",
      tone: "danger"
    });
  }

  async function deleteMemo(memo: PublicMemoItem) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/place-memos/${memo.id}`, {
        credentials: "same-origin",
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setConfirmAction(null);
      setStatus("삭제했습니다.");
      await refreshMemos();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
}

function MemoSummary({
  busy,
  memo,
  onDelete,
  onSave
}: {
  busy?: boolean;
  memo: PublicMemoItem;
  onDelete?: (memo: PublicMemoItem) => void;
  onSave?: (memo: PublicMemoItem, body: string) => Promise<boolean>;
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [draftBody, setDraftBody] = useState(memo.body);

  useEffect(() => {
    if (!editDialogOpen) setDraftBody(memo.body);
  }, [editDialogOpen, memo.body]);

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSave) return;
    const saved = await onSave(memo, draftBody);
    if (saved) setEditDialogOpen(false);
  }

  return (
    <article className={`place-memo-summary ${memo.isMine ? "is-mine" : ""}`}>
      <div className="place-memo-summary-top">
        <div className="place-memo-summary-head">
          {memo.isMine ? <strong className="mine-chip">내 장소 팁</strong> : null}
          {memo.displayName && !memo.isMine ? <span>{memo.displayName}</span> : null}
          <button className="summary-date-button" onClick={() => setDateDialogOpen(true)} type="button">
            <time dateTime={memo.updatedAt}>{formatRelativeDate(memo.updatedAt)}</time>
          </button>
        </div>
        {memo.isMine && onSave && onDelete ? (
          <div className="place-memo-summary-actions">
            <button disabled={busy || editDialogOpen} onClick={() => setEditDialogOpen(true)} type="button">
              <Edit3 size={14} aria-hidden="true" />
              수정
            </button>
            <button disabled={busy} onClick={() => onDelete(memo)} type="button">
              <Trash2 size={14} aria-hidden="true" />
              삭제
            </button>
          </div>
        ) : null}
      </div>
      <p>{memo.body}</p>
      <AppModal onClose={() => setDateDialogOpen(false)} open={dateDialogOpen} title="작성 시각">
        <div className="app-modal-copy">
          <p>{formatExactMemoDate(memo.updatedAt)}</p>
        </div>
      </AppModal>
      <AppModal
        disabled={busy}
        onClose={() => setEditDialogOpen(false)}
        open={editDialogOpen}
        title="장소 이용 팁 수정"
      >
        <form className="place-memo-form is-modal" onSubmit={submitEdit}>
          <MemoBodyField disabled={busy} onChange={setDraftBody} value={draftBody} />
          <AppModalActions>
            <button className="app-modal-cancel" disabled={busy} onClick={() => setEditDialogOpen(false)} type="button">
              취소
            </button>
            <button className="app-modal-submit" disabled={busy || draftBody.trim().length === 0} type="submit">
              {busy ? "저장 중" : "저장"}
            </button>
          </AppModalActions>
        </form>
      </AppModal>
    </article>
  );
}

function MemoBodyField({
  disabled,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="place-memo-field">
      <span>
        장소 이용 팁
        <small>{value.length}/{MEMO_MAX_LENGTH}</small>
      </span>
      <textarea
        disabled={disabled}
        maxLength={MEMO_MAX_LENGTH}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="예: 유모차는 북문 엘리베이터가 편하고, 주말 오전에는 지하 2층 주차가 덜 붐벼요."
        rows={4}
        value={value}
      />
    </label>
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

function memoSearchText(memo: PublicMemoItem) {
  return normalizeListSearchText(
    [memo.body, memo.displayName, memo.isMine ? "내 팁 내가 쓴 팁" : "", formatRelativeDate(memo.updatedAt), formatExactMemoDate(memo.updatedAt)]
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

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "방금 전";
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < hourMs) return "방금 전";
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}시간 전`;
  const days = Math.floor(diffMs / dayMs);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}달 전`;
  return `${Math.floor(months / 12)}년 전`;
}

function formatExactMemoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}
