"use client";

import { RotateCcw } from "lucide-react";

import { searchParamsForResetPreservingMapLocation } from "@/app/search-url-state";

export function SearchResetButton() {
  function resetSearch() {
    const params = searchParamsForResetPreservingMapLocation(window.location.search);
    const query = params.toString();
    window.location.href = `/${query ? `?${query}` : ""}`;
  }

  return (
    <button
      aria-label="검색 조건 초기화"
      className="reset-search-button"
      title="검색 조건 초기화"
      type="button"
      onClick={resetSearch}
    >
      <RotateCcw size={16} aria-hidden="true" />
      <span className="reset-search-button-label">초기화</span>
    </button>
  );
}
