"use client";

import { useEffect } from "react";

const VIEW_THROTTLE_MS = 5 * 60 * 1000;

export function PlaceViewRecorder({ placeId }: { placeId: string }) {
  useEffect(() => {
    const storageKey = `aigo-place-view:${placeId}`;
    const now = Date.now();

    try {
      const lastRecordedAt = Number(window.sessionStorage.getItem(storageKey) ?? 0);
      if (Number.isFinite(lastRecordedAt) && now - lastRecordedAt < VIEW_THROTTLE_MS) return;
      window.sessionStorage.setItem(storageKey, String(now));
    } catch {
      // sessionStorage is best-effort; recording should not block detail viewing.
    }

    void fetch(`/api/places/${placeId}/views`, {
      credentials: "same-origin",
      method: "POST"
    }).catch(() => {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore storage failures.
      }
    });
  }, [placeId]);

  return null;
}
