export type DuplicateCandidateSignals = {
  aliasMatch?: boolean;
  addressMatch?: boolean;
  regionMatch?: boolean;
  externalRefsMatch: boolean;
  kakaoPlaceIdMatch: boolean;
  distanceMeters: number | null;
  nameSimilarity: number | null;
};

export function duplicateReasonCodes(signals: DuplicateCandidateSignals) {
  const reasonCodes: string[] = [];

  if (signals.kakaoPlaceIdMatch) {
    reasonCodes.push("KAKAO_PLACE_ID_MATCH");
  }

  if (signals.externalRefsMatch) {
    reasonCodes.push("EXTERNAL_REF_MATCH");
  }

  if (signals.aliasMatch) {
    reasonCodes.push("ALIAS_MATCH");
  }

  if (signals.addressMatch) {
    reasonCodes.push("ADDRESS_MATCH");
  } else if (signals.regionMatch) {
    reasonCodes.push("REGION_MATCH");
  }

  if (signals.distanceMeters !== null && signals.distanceMeters <= 500) {
    reasonCodes.push("GEO_NEAR");
  }

  if (signals.nameSimilarity !== null && signals.nameSimilarity >= 0.45) {
    reasonCodes.push("NAME_SIMILAR");
  }

  return reasonCodes;
}

export function duplicateConfidence(signals: DuplicateCandidateSignals) {
  if (signals.externalRefsMatch) return "high";
  if (signals.kakaoPlaceIdMatch) return "high";
  if (signals.addressMatch && ((signals.nameSimilarity ?? 0) >= 0.35 || signals.aliasMatch)) return "high";
  if (signals.aliasMatch && (signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) return "high";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 150 && (signals.nameSimilarity ?? 0) >= 0.85) return "high";
  if (signals.regionMatch && ((signals.nameSimilarity ?? 0) >= 0.65 || signals.aliasMatch)) return "medium";
  if (signals.addressMatch) return "medium";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 500 && (signals.nameSimilarity ?? 0) >= 0.35) return "medium";
  return "low";
}
