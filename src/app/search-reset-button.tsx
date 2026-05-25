"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

const DEFAULT_SEARCH_MAP_VIEW_KEY = "36.5000,127.8000";
const MAP_VIEW_STORAGE_KEY = "aigo:places-map-view:v4";
const RESET_MAP_ZOOM = 12;

export function SearchResetButton() {
  const [isResetting, setIsResetting] = useState(false);

  function resetSearch() {
    if (!navigator.geolocation) {
      window.location.href = "/";
      return;
    }

    setIsResetting(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        saveResetMapView(coords.latitude, coords.longitude);
        window.location.href = "/";
      },
      () => {
        window.location.href = "/";
      },
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 5000 }
    );
  }

  return (
    <button
      aria-label="검색 조건 초기화"
      className="reset-search-button"
      title="검색 조건 초기화"
      type="button"
      onClick={resetSearch}
      disabled={isResetting}
    >
      <RotateCcw size={16} aria-hidden="true" />
      {isResetting ? "초기화 중" : "초기화"}
    </button>
  );
}

function saveResetMapView(lat: number, lng: number) {
  try {
    const saved = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      MAP_VIEW_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        [DEFAULT_SEARCH_MAP_VIEW_KEY]: {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          zoom: RESET_MAP_ZOOM
        }
      })
    );
  } catch {
    // Reset should still clear search state when storage is unavailable.
  }
}
