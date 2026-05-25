"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { DEFAULT_SEARCH_MAP_CENTER, saveResetMapViewToStorage } from "@/app/search-reset-map-view";

export function SearchResetButton() {
  const [isResetting, setIsResetting] = useState(false);

  function resetSearch() {
    if (!navigator.geolocation) {
      saveResetMapView(DEFAULT_SEARCH_MAP_CENTER.lat, DEFAULT_SEARCH_MAP_CENTER.lng);
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
        saveResetMapView(DEFAULT_SEARCH_MAP_CENTER.lat, DEFAULT_SEARCH_MAP_CENTER.lng);
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
    saveResetMapViewToStorage(window.sessionStorage, lat, lng);
  } catch {
    // Reset should still clear search state when storage is unavailable.
  }
}
