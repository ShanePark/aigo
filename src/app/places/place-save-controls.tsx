"use client";

import { Bookmark, Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PlaceSaveState = {
  heartCount: number;
  hearted: boolean;
  placeId: string;
  updatedAt: string | null;
  wantToGo: boolean;
};

type SaveTarget = "wantToGo" | "hearted";

type PlaceSaveControlsProps = {
  compact?: boolean;
  placeId: string;
};

export function PlaceSaveControls({ compact = false, placeId }: PlaceSaveControlsProps) {
  const [state, setState] = useState<PlaceSaveState | null>(null);
  const [pendingTarget, setPendingTarget] = useState<SaveTarget | null>(null);
  const [status, setStatus] = useState<"idle" | "login" | "error">("idle");

  useEffect(() => {
    let ignore = false;
    setState(null);
    setStatus("idle");

    void fetch(`/api/places/${placeId}/saves`, { credentials: "same-origin" })
      .then(async (response) => {
        if (ignore) return;
        if (response.status === 401) {
          setStatus("login");
          setState(emptyState(placeId));
          return;
        }
        if (!response.ok) {
          setStatus("error");
          setState(emptyState(placeId));
          return;
        }

        const body = (await response.json()) as { item: PlaceSaveState };
        setState(body.item);
      })
      .catch(() => {
        if (ignore) return;
        setStatus("error");
        setState(emptyState(placeId));
      });

    return () => {
      ignore = true;
    };
  }, [placeId]);

  const items = useMemo(
    () => [
      {
        active: state?.wantToGo ?? false,
        icon: Bookmark,
        label: "가고 싶음",
        target: "wantToGo" as const
      },
      {
        active: state?.hearted ?? false,
        icon: Heart,
        label: "하트",
        target: "hearted" as const
      }
    ],
    [state]
  );

  async function toggle(target: SaveTarget) {
    if (!state || pendingTarget) return;
    if (status === "login") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    const nextValue = !state[target];
    setPendingTarget(target);
    setStatus("idle");

    try {
      const response = await fetch(`/api/places/${placeId}/saves`, {
        body: JSON.stringify({ [target]: nextValue }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });

      if (response.status === 401) {
        setStatus("login");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }

      const body = (await response.json()) as { item: PlaceSaveState };
      setState(body.item);
    } catch {
      setStatus("error");
    } finally {
      setPendingTarget(null);
    }
  }

  return (
    <div className={`place-save-controls ${compact ? "is-compact" : ""}`} aria-label="장소 저장">
      {items.map((item) => {
        const Icon = item.icon;
        const pending = pendingTarget === item.target;
        return (
          <button
            aria-pressed={item.active}
            className={`place-save-button ${item.active ? "is-active" : ""}`}
            disabled={!state || Boolean(pendingTarget)}
            key={item.target}
            onClick={() => void toggle(item.target)}
            title={status === "login" ? "로그인 후 저장할 수 있어요" : item.label}
            type="button"
          >
            <Icon size={compact ? 14 : 15} aria-hidden="true" fill={item.target === "hearted" && item.active ? "currentColor" : "none"} />
            <span>{pending ? "저장 중" : item.label}</span>
          </button>
        );
      })}
      <span className="place-save-heart-count" aria-label={`하트 ${state?.heartCount ?? 0}개`}>
        <Heart size={compact ? 13 : 14} aria-hidden="true" fill="currentColor" />
        {state?.heartCount ?? 0}
      </span>
      {status === "error" ? <span className="place-save-status">저장 실패</span> : null}
    </div>
  );
}

function emptyState(placeId: string): PlaceSaveState {
  return {
    heartCount: 0,
    hearted: false,
    placeId,
    updatedAt: null,
    wantToGo: false
  };
}
