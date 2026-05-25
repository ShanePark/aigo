export type HomeDraft = {
  addressText: string;
  enabled: boolean;
  label: string;
  lat: string;
  lng: string;
};

export type HomeSaveUiState = {
  buttonText: string;
  disabled: boolean;
  dirty: boolean;
  invalidCoordinates: boolean;
  statusLabel: string;
};

export function homeSaveUiState(homeLocation: HomeDraft, savedHomeLocation: HomeDraft, options: { isSaving?: boolean; saving?: boolean } = {}): HomeSaveUiState {
  const dirty = homeSignature(homeLocation) !== homeSignature(savedHomeLocation);
  const savedHasCoordinates = homeLocationHasUsableCoordinates(savedHomeLocation);
  const draftHasCoordinates = homeLocationHasUsableCoordinates(homeLocation);
  const invalidCoordinates = homeLocation.enabled && !draftHasCoordinates;

  if (options.saving) {
    return {
      buttonText: "저장 중",
      disabled: true,
      dirty,
      invalidCoordinates,
      statusLabel: "저장 중"
    };
  }

  if (!homeLocation.enabled) {
    const deletingSavedLocation = dirty && savedHasCoordinates;
    return {
      buttonText: deletingSavedLocation ? "집 위치 삭제 저장" : "집 위치 미설정",
      disabled: Boolean(options.isSaving) || !deletingSavedLocation,
      dirty,
      invalidCoordinates: false,
      statusLabel: deletingSavedLocation ? "삭제 예정" : "미설정"
    };
  }

  if (invalidCoordinates) {
    return {
      buttonText: "좌표 입력 필요",
      disabled: true,
      dirty,
      invalidCoordinates,
      statusLabel: "좌표 필요"
    };
  }

  return {
    buttonText: dirty ? (savedHasCoordinates ? "수정 저장" : "집 위치 저장") : "저장됨",
    disabled: Boolean(options.isSaving) || !dirty,
    dirty,
    invalidCoordinates,
    statusLabel: dirty ? "수정 필요" : "저장됨"
  };
}

export function homeLocationHasUsableCoordinates(homeLocation: HomeDraft) {
  if (!homeLocation.enabled || homeLocation.lat.trim().length === 0 || homeLocation.lng.trim().length === 0) {
    return false;
  }

  const lat = Number(homeLocation.lat);
  const lng = Number(homeLocation.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function homeSignature(homeLocation: HomeDraft) {
  if (!homeLocation.enabled) return "disabled";

  return [
    "enabled",
    homeLocation.label.trim() || "home",
    homeLocation.lat.trim(),
    homeLocation.lng.trim(),
    homeLocation.addressText.trim()
  ].join("|");
}
