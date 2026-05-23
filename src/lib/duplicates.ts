import { normalizeRegionSido } from "@/lib/taxonomy";

export type DuplicateCandidateSignals = {
  aliasMatch?: boolean;
  addressMatch?: boolean;
  addressRegionConflict?: boolean;
  regionMatch?: boolean;
  genericBranchName?: boolean;
  sameSigunguMatch?: boolean;
  externalRefsMatch: boolean;
  kakaoPlaceIdMatch: boolean;
  distanceMeters: number | null;
  nameSimilarity: number | null;
  radiusMeters?: number | null;
};

export type DuplicateLocationInput = {
  address?: string | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
  roadAddress?: string | null;
  radiusMeters?: number | null;
};

export type DuplicateLocationCandidate = {
  address?: string | null;
  addressMatch?: boolean;
  distanceMeters: number | null;
  regionMatch?: boolean;
  regionSido?: string | null;
  regionSigungu?: string | null;
  roadAddress?: string | null;
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

  if (signals.genericBranchName) {
    reasonCodes.push("GENERIC_BRANCH_NAME");
  }

  if (signals.addressMatch) {
    reasonCodes.push("ADDRESS_MATCH");
  } else if (signals.regionMatch) {
    reasonCodes.push("REGION_MATCH");
  }

  if (signals.addressRegionConflict) {
    reasonCodes.push("ADDRESS_REGION_CONFLICT");
  }

  if (signals.distanceMeters !== null && signals.distanceMeters <= 500) {
    reasonCodes.push("GEO_NEAR");
  } else if (
    signals.radiusMeters !== null &&
    signals.radiusMeters !== undefined &&
    signals.distanceMeters !== null &&
    signals.distanceMeters > signals.radiusMeters
  ) {
    reasonCodes.push("GEO_OUTSIDE_REQUEST_RADIUS");
  }

  if (signals.nameSimilarity !== null && signals.nameSimilarity >= 0.45) {
    reasonCodes.push("NAME_SIMILAR");
  }

  return reasonCodes;
}

export function duplicateConfidence(signals: DuplicateCandidateSignals) {
  if (signals.externalRefsMatch) return "high";
  if (signals.kakaoPlaceIdMatch) return "high";
  if (signals.addressRegionConflict && !hasStrictLocationMatch(signals)) return "low";
  if (signals.genericBranchName && !hasStrictLocationMatch(signals)) return "low";
  if (signals.addressMatch && ((signals.nameSimilarity ?? 0) >= 0.35 || signals.aliasMatch)) return "high";
  if (signals.aliasMatch && (signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) return "high";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 150 && (signals.nameSimilarity ?? 0) >= 0.85) return "high";
  if (signals.regionMatch && ((signals.nameSimilarity ?? 0) >= 0.65 || signals.aliasMatch)) return "medium";
  if (signals.addressMatch) return "medium";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 500 && (signals.nameSimilarity ?? 0) >= 0.35) return "medium";
  return "low";
}

export function duplicateGenericBranchName(inputName: string, candidateName: string) {
  const input = compactDuplicateText(inputName);
  const candidate = compactDuplicateText(candidateName);
  return genericBranchNameTerms.some((term) => input.includes(term) && candidate.includes(term));
}

export function duplicateLocationSignals(input: DuplicateLocationInput, candidate: DuplicateLocationCandidate) {
  const inputSido = duplicateSidoFromLocation(input.regionSido, input.roadAddress, input.address);
  const candidateSido = duplicateSidoFromLocation(candidate.regionSido, candidate.roadAddress, candidate.address);
  const inputSigungu = compactDuplicateText(input.regionSigungu ?? "");
  const candidateSigungu = compactDuplicateText(candidate.regionSigungu ?? "");
  const sidoConflict = Boolean(inputSido && candidateSido && inputSido !== candidateSido);
  const sameSigunguMatch = Boolean(!sidoConflict && inputSigungu && candidateSigungu && inputSigungu === candidateSigungu);
  const sigunguConflict = Boolean(!sidoConflict && inputSigungu && candidateSigungu && inputSigungu !== candidateSigungu);
  const nearby = candidate.distanceMeters !== null && candidate.distanceMeters <= (input.radiusMeters ?? 500);
  const hasSourceBackedLocation = Boolean(inputSido || inputSigungu || input.address || input.roadAddress);
  const hasCandidateLocation = Boolean(candidateSido || candidateSigungu || candidate.address || candidate.roadAddress);

  return {
    addressRegionConflict: Boolean(
      hasSourceBackedLocation &&
        hasCandidateLocation &&
        !candidate.addressMatch &&
        !nearby &&
        (sidoConflict || sigunguConflict || (!candidate.regionMatch && (inputSido || inputSigungu)))
    ),
    sameSigunguMatch
  };
}

function hasStrictLocationMatch(signals: DuplicateCandidateSignals) {
  return Boolean(
    signals.addressMatch ||
      signals.sameSigunguMatch ||
      (signals.distanceMeters !== null && signals.distanceMeters <= 1000)
  );
}

function duplicateSidoFromLocation(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeDuplicateSido(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeDuplicateSido(value: string) {
  const normalized = normalizeRegionSido(value.trim());
  if (duplicateSidoAliases.some(({ canonical }) => normalized === canonical)) return normalized;

  const compact = compactDuplicateText(value);
  const match = duplicateSidoAliases.find(({ aliases }) => aliases.some((alias) => compact.includes(alias)));
  return match?.canonical ?? null;
}

function compactDuplicateText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

const genericBranchNameTerms = [
  "감자탕",
  "닭갈비",
  "샤브",
  "샤브샤브",
  "라라코스트",
  "돈까스",
  "칼국수",
  "국밥",
  "갈비",
  "쭈꾸미",
  "짬뽕",
  "설렁탕"
];

const duplicateSidoAliases = [
  { canonical: "서울특별시", aliases: ["서울", "서울특별시"] },
  { canonical: "부산광역시", aliases: ["부산", "부산광역시"] },
  { canonical: "대구광역시", aliases: ["대구", "대구광역시"] },
  { canonical: "인천광역시", aliases: ["인천", "인천광역시"] },
  { canonical: "광주광역시", aliases: ["광주", "광주광역시"] },
  { canonical: "대전광역시", aliases: ["대전", "대전광역시"] },
  { canonical: "울산광역시", aliases: ["울산", "울산광역시"] },
  { canonical: "세종특별자치시", aliases: ["세종", "세종특별자치시"] },
  { canonical: "경기도", aliases: ["경기", "경기도"] },
  { canonical: "강원특별자치도", aliases: ["강원", "강원도", "강원특별자치도"] },
  { canonical: "충청북도", aliases: ["충북", "충청북도"] },
  { canonical: "충청남도", aliases: ["충남", "충청남도"] },
  { canonical: "전북특별자치도", aliases: ["전북", "전라북도", "전북특별자치도"] },
  { canonical: "전라남도", aliases: ["전남", "전라남도"] },
  { canonical: "경상북도", aliases: ["경북", "경상북도"] },
  { canonical: "경상남도", aliases: ["경남", "경상남도"] },
  { canonical: "제주특별자치도", aliases: ["제주", "제주도", "제주특별자치도"] }
].map(({ canonical, aliases }) => ({
  canonical,
  aliases: aliases.map(compactDuplicateText)
}));
