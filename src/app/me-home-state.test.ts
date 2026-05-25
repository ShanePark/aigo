import { describe, expect, it } from "vitest";

import { homeLocationHasUsableCoordinates, homeSaveUiState, type HomeDraft } from "@/app/me-home-state";

const emptyHome: HomeDraft = {
  addressText: "",
  enabled: false,
  label: "home",
  lat: "",
  lng: ""
};

const savedHome: HomeDraft = {
  addressText: "대전역 근처",
  enabled: true,
  label: "home",
  lat: "36.332",
  lng: "127.434"
};

describe("me home location state", () => {
  it("does not show a saved state when no home location exists", () => {
    expect(homeSaveUiState(emptyHome, emptyHome)).toMatchObject({
      buttonText: "집 위치 미설정",
      disabled: true,
      dirty: false,
      statusLabel: "미설정"
    });
  });

  it("blocks saving when home location is enabled without coordinates", () => {
    const draft = { ...emptyHome, enabled: true };

    expect(homeSaveUiState(draft, emptyHome)).toMatchObject({
      buttonText: "좌표 입력 필요",
      disabled: true,
      dirty: true,
      invalidCoordinates: true,
      statusLabel: "좌표 필요"
    });
  });

  it("separates deletion from an unchanged saved home location", () => {
    expect(homeSaveUiState({ ...savedHome, enabled: false }, savedHome)).toMatchObject({
      buttonText: "집 위치 삭제 저장",
      disabled: false,
      dirty: true,
      statusLabel: "삭제 예정"
    });
  });

  it("detects usable coordinate strings", () => {
    expect(homeLocationHasUsableCoordinates(savedHome)).toBe(true);
    expect(homeLocationHasUsableCoordinates({ ...savedHome, lat: "" })).toBe(false);
    expect(homeLocationHasUsableCoordinates({ ...savedHome, lat: "91" })).toBe(false);
  });
});
