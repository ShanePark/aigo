"use client";

import { Bookmark, Heart } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PlaceSaveState = {
  heartCount: number;
  hearted: boolean;
  placeId: string;
  updatedAt: string | null;
  wantToGo: boolean;
};

type SaveTarget = "wantToGo" | "hearted";
type SaveControlStatus = "idle" | "login" | "error";

type PlaceSaveControlsContextValue = {
  loaded: boolean;
  setPlaceState: (state: PlaceSaveState) => void;
  setStatus: (status: SaveControlStatus) => void;
  states: Map<string, PlaceSaveState>;
  status: SaveControlStatus;
};

type PlaceSaveControlsProps = {
  compact?: boolean;
  placeId: string;
};

const PlaceSaveControlsContext = createContext<PlaceSaveControlsContextValue | null>(null);

export function PlaceSaveControlsProvider({ children, placeIds }: { children: ReactNode; placeIds: string[] }) {
  const placeIdKey = Array.from(new Set(placeIds)).filter(Boolean).join("|");
  const uniquePlaceIds = useMemo(() => (placeIdKey ? placeIdKey.split("|") : []), [placeIdKey]);
  const [states, setStates] = useState<Map<string, PlaceSaveState>>(new Map());
  const [loaded, setLoaded] = useState(uniquePlaceIds.length === 0);
  const [status, setStatus] = useState<SaveControlStatus>("idle");

  useEffect(() => {
    let ignore = false;
    setStates(new Map());
    setLoaded(uniquePlaceIds.length === 0);
    setStatus("idle");

    if (uniquePlaceIds.length === 0) return;

    void fetch("/api/places/save-states", {
      body: JSON.stringify({ placeIds: uniquePlaceIds }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST"
    })
      .then(async (response) => {
        if (ignore) return;
        if (response.status === 401) {
          setStatus("login");
          setStates(new Map<string, PlaceSaveState>(uniquePlaceIds.map((placeId) => [placeId, emptyState(placeId)])));
          setLoaded(true);
          return;
        }
        if (!response.ok) {
          setStatus("error");
          setStates(new Map<string, PlaceSaveState>(uniquePlaceIds.map((placeId) => [placeId, emptyState(placeId)])));
          setLoaded(true);
          return;
        }

        const body = (await response.json()) as { items: PlaceSaveState[] };
        const nextStates = new Map<string, PlaceSaveState>(uniquePlaceIds.map((placeId) => [placeId, emptyState(placeId)]));
        for (const item of body.items) {
          nextStates.set(item.placeId, item);
        }
        setStates(nextStates);
        setLoaded(true);
      })
      .catch(() => {
        if (ignore) return;
        setStatus("error");
        setStates(new Map<string, PlaceSaveState>(uniquePlaceIds.map((placeId) => [placeId, emptyState(placeId)])));
        setLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [placeIdKey, uniquePlaceIds]);

  const contextValue = useMemo<PlaceSaveControlsContextValue>(
    () => ({
      loaded,
      setPlaceState: (state) => {
        setStates((current) => {
          const next = new Map(current);
          next.set(state.placeId, state);
          return next;
        });
      },
      setStatus,
      states,
      status
    }),
    [loaded, states, status]
  );

  return <PlaceSaveControlsContext.Provider value={contextValue}>{children}</PlaceSaveControlsContext.Provider>;
}

export function PlaceSaveControls({ compact = false, placeId }: PlaceSaveControlsProps) {
  const batch = useContext(PlaceSaveControlsContext);
  const [localState, setLocalState] = useState<PlaceSaveState | null>(null);
  const [pendingTarget, setPendingTarget] = useState<SaveTarget | null>(null);
  const [localStatus, setLocalStatus] = useState<SaveControlStatus>("idle");
  const state = batch ? (batch.loaded ? (batch.states.get(placeId) ?? emptyState(placeId)) : null) : localState;
  const status = batch ? batch.status : localStatus;

  useEffect(() => {
    if (batch) return;

    let ignore = false;
    setLocalState(null);
    setLocalStatus("idle");

    void fetch(`/api/places/${placeId}/saves`, { credentials: "same-origin" })
      .then(async (response) => {
        if (ignore) return;
        if (response.status === 401) {
          setLocalStatus("login");
          setLocalState(emptyState(placeId));
          return;
        }
        if (!response.ok) {
          setLocalStatus("error");
          setLocalState(emptyState(placeId));
          return;
        }

        const body = (await response.json()) as { item: PlaceSaveState };
        setLocalState(body.item);
      })
      .catch(() => {
        if (ignore) return;
        setLocalStatus("error");
        setLocalState(emptyState(placeId));
      });

    return () => {
      ignore = true;
    };
  }, [batch, placeId]);

  const items = useMemo(
    () => [
      {
        active: state?.wantToGo ?? false,
        icon: Bookmark,
        label: "찜",
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
      redirectToLogin();
      return;
    }

    const nextValue = !state[target];
    setPendingTarget(target);
    if (batch) {
      batch.setStatus("idle");
    } else {
      setLocalStatus("idle");
    }

    try {
      const response = await fetch(`/api/places/${placeId}/saves`, {
        body: JSON.stringify({ [target]: nextValue }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        if (batch) {
          batch.setStatus("error");
        } else {
          setLocalStatus("error");
        }
        return;
      }

      const body = (await response.json()) as { item: PlaceSaveState };
      if (batch) {
        batch.setPlaceState(body.item);
      } else {
        setLocalState(body.item);
      }
    } catch {
      if (batch) {
        batch.setStatus("error");
      } else {
        setLocalStatus("error");
      }
    } finally {
      setPendingTarget(null);
    }
  }

  return (
    <div className={`place-save-controls ${compact ? "is-compact" : ""}`} aria-label="장소 저장">
      {items.map((item) => {
        const Icon = item.icon;
        const pending = pendingTarget === item.target;
        const heartCount = state?.heartCount ?? 0;
        const buttonText = item.target === "hearted" && !compact && !pending ? `${item.label} ${heartCount}` : pending ? "저장 중" : item.label;
        const buttonLabel =
          status === "login"
            ? "로그인 후 저장할 수 있어요"
            : item.target === "hearted" && !pending
              ? `하트 ${heartCount}개`
              : pending
                ? `${item.label} 저장 중`
                : item.label;
        return (
          <button
            aria-label={buttonLabel}
            aria-pressed={item.active}
            className={`place-save-button is-${item.target === "wantToGo" ? "want-to-go" : "hearted"} ${item.active ? "is-active" : ""}`}
            disabled={!state || Boolean(pendingTarget)}
            key={item.target}
            onClick={() => void toggle(item.target)}
            title={buttonLabel}
            type="button"
          >
            <Icon size={compact ? 14 : 15} aria-hidden="true" fill={item.active ? "currentColor" : "none"} />
            <span className={compact ? "sr-only" : ""}>{buttonText}</span>
          </button>
        );
      })}
      {status === "error" ? <span className={`place-save-status ${compact ? "sr-only" : ""}`}>저장 실패</span> : null}
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

function redirectToLogin() {
  window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}
