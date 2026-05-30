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

    void postPlaceView(placeId)
      .then((recorded) => {
        if (!recorded) removeViewMarker(storageKey);
      })
      .catch(() => {
        removeViewMarker(storageKey);
      });
  }, [placeId]);

  return null;
}

export async function postPlaceView(placeId: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/api/places/${placeId}/views`, {
    credentials: "same-origin",
    method: "POST"
  });
  return response.ok;
}

function removeViewMarker(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}
