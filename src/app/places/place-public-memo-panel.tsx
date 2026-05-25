"use client";

import { Edit3, Info, Lightbulb, LogIn, MessageSquareText, Search, Trash2 } from "lucide-react";
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
  devLoginEnabled: boolean;
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
  const [memoHelpOpen, setMemoHelpOpen] = useState(false);
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);
  const myMemo = useMemo(() => memos?.items.find((memo) => memo.isMine) ?? null, [memos]);
  const publicMemos = memos?.items ?? [];

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
            <InfoButton label="장소 이용 팁 안내" onClick={() => setMemoHelpOpen(true)} />
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="place-memo-login-card">
          <div className="place-memo-login-copy">
            <strong>장소 이용 팁을 불러오는 중입니다.</strong>
            <p>공개 메모와 로그인 상태를 확인하고 있어요.</p>
          </div>
        </div>
      ) : user && !myMemo ? (
        <div className="place-memo-action-card">
          <div className="place-memo-action-copy">
            <strong>주차, 동선, 준비물 팁 공유</strong>
          </div>
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
          {status ? <p className="place-memo-action-status">{status}</p> : null}
        </div>
      ) : user ? (
        <div className="place-memo-hint">
          <Lightbulb size={16} aria-hidden="true" />
          <p>내 공개 팁은 하나만 유지됩니다.</p>
          <InfoButton label="공개 팁 수정 안내" onClick={() => setMemoHelpOpen(true)} />
          {status ? <span>{status}</span> : null}
        </div>
      ) : (
        <div className="place-memo-login-card">
          <div className="place-memo-login-copy">
            <strong>공개 팁은 로그인 후 남길 수 있어요.</strong>
            <p>장소 이용 노하우를 공개로 공유합니다.</p>
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
      )}

      <div className="place-memo-list">
        <div className="place-memo-list-head">
          <h3>공개 팁</h3>
          <span>{publicMemos.length}개</span>
        </div>
        {loading ? (
          <p className="place-memo-empty">공개 팁을 불러오는 중입니다.</p>
        ) : publicMemos.length > 0 ? (
          publicMemos.map((memo) => (
            <MemoSummary
              busy={busy}
              key={memo.id}
              memo={memo}
              onDelete={memo.isMine ? requestDeleteMemo : undefined}
              onSave={memo.isMine ? saveMemoEdit : undefined}
            />
          ))
        ) : (
          <p className="place-memo-empty">아직 공개된 장소 이용 팁이 없습니다.</p>
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
      <AppModal onClose={() => setMemoHelpOpen(false)} open={memoHelpOpen} title="장소 이용 팁 안내">
        <div className="app-modal-copy">
          <p>방문 여부와 별점에는 반영하지 않는 공개 메모입니다.</p>
          <p>주차, 동선, 준비물, 유모차, 대기처럼 다른 가족이 바로 참고할 수 있는 정보를 남겨주세요.</p>
          <p>장소당 내 공개 팁은 하나만 유지되며, 아래 내 팁에서 언제든 수정하거나 삭제할 수 있습니다.</p>
        </div>
      </AppModal>
      <AppModal
        description="방문 기록과 별점에는 반영하지 않는 공개 장소 이용 팁입니다."
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
    <article className="place-memo-summary">
      <div className="place-memo-summary-top">
        <div className="place-memo-summary-head">
          {memo.isMine ? <strong>내 팁</strong> : null}
          {memo.displayName && !memo.isMine ? <span>{memo.displayName}</span> : null}
          <time dateTime={memo.updatedAt}>{formatMemoDate(memo.updatedAt)}</time>
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
      <AppModal
        description="공개 장소 이용 팁은 방문 기록과 별점에는 반영되지 않습니다."
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

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="context-info-button" aria-label={label} onClick={onClick} type="button">
      <Info size={14} aria-hidden="true" />
    </button>
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

function formatMemoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "short"
  }).format(date);
}
