import { normalizeRegionSido } from "@/lib/taxonomy";

export type DuplicateCandidateSignals = {
  aliasMatch?: boolean;
  addressMatch?: boolean;
  addressRegionConflict?: boolean;
  regionMatch?: boolean;
  genericBranchName?: boolean;
  branchSiblingReviewOnly?: boolean;
  lodgingClusterReviewOnly?: boolean;
  weakThematicSimilarityReviewOnly?: boolean;
  genericAliasReviewOnly?: boolean;
  publicSubfacilityReviewOnly?: boolean;
  sameBuildingReviewOnly?: boolean;
  sameSidoGenericReviewOnly?: boolean;
  sameSigunguMatch?: boolean;
  externalRefsMatch: boolean;
  kakaoPlaceIdMatch: boolean;
  distanceMeters: number | null;
  nameSimilarity: number | null;
  radiusMeters?: number | null;
};

export type DuplicateCandidateSuggestedAction = "update_existing" | "manual_duplicate_review" | "hold_duplicate_review";
export type DuplicateCandidateRelationshipHint = "same_building" | "parent_child" | null;

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

  if (signals.branchSiblingReviewOnly) {
    reasonCodes.push("BRANCH_SIBLING_REVIEW_ONLY");
  }

  if (signals.lodgingClusterReviewOnly) {
    reasonCodes.push("LODGING_CLUSTER_REVIEW_ONLY");
  }

  if (signals.weakThematicSimilarityReviewOnly) {
    reasonCodes.push("WEAK_THEMATIC_SIMILARITY_REVIEW_ONLY");
  }

  if (signals.genericAliasReviewOnly) {
    reasonCodes.push("GENERIC_ALIAS_REVIEW_ONLY");
  }

  if (signals.publicSubfacilityReviewOnly) {
    reasonCodes.push("PUBLIC_SUBFACILITY_REVIEW_ONLY");
  }

  if (signals.addressMatch) {
    reasonCodes.push("ADDRESS_MATCH");
  } else if (signals.regionMatch) {
    reasonCodes.push("REGION_MATCH");
  }

  if (signals.addressRegionConflict) {
    reasonCodes.push("ADDRESS_REGION_CONFLICT");
  }

  if (signals.sameBuildingReviewOnly) {
    reasonCodes.push("SAME_BUILDING_REVIEW_ONLY");
  }

  if (signals.sameSidoGenericReviewOnly) {
    reasonCodes.push("SAME_SIDO_GENERIC_REVIEW_ONLY");
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
    if (duplicateOutsideRadiusReviewOnly(signals)) {
      reasonCodes.push("OUTSIDE_RADIUS_REVIEW_ONLY");
    }
  }

  if (signals.nameSimilarity !== null && signals.nameSimilarity >= 0.45) {
    reasonCodes.push("NAME_SIMILAR");
  }

  return reasonCodes;
}

export function duplicateConfidence(signals: DuplicateCandidateSignals) {
  if (signals.externalRefsMatch) return "high";
  if (signals.kakaoPlaceIdMatch) return "high";
  if (duplicateOutsideRadiusReviewOnly(signals)) return "low";
  if (signals.addressRegionConflict && !hasStrictLocationMatch(signals)) return "low";
  if (signals.branchSiblingReviewOnly && !hasStrictLocationMatch(signals)) return "low";
  if (signals.lodgingClusterReviewOnly && !hasStrongIdentityEvidence(signals)) return "medium";
  if (signals.weakThematicSimilarityReviewOnly && !hasStrictLocationMatch(signals)) return "low";
  if (signals.genericAliasReviewOnly && !hasStrictLocationMatch(signals)) return "low";
  if (signals.genericBranchName && !hasStrictLocationMatch(signals)) return "low";
  if (signals.sameSidoGenericReviewOnly && !hasStrictLocationMatch(signals)) return "low";
  if (signals.publicSubfacilityReviewOnly && !signals.aliasMatch) return "medium";
  if (signals.sameBuildingReviewOnly) return "medium";
  if (signals.branchSiblingReviewOnly) return "medium";
  if (signals.addressMatch && ((signals.nameSimilarity ?? 0) >= 0.35 || signals.aliasMatch)) return "high";
  if (signals.aliasMatch && (signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) return "high";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 150 && (signals.nameSimilarity ?? 0) >= 0.85) return "high";
  if (signals.regionMatch && ((signals.nameSimilarity ?? 0) >= 0.65 || signals.aliasMatch)) return "medium";
  if (signals.addressMatch) return "medium";
  if ((signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 500 && (signals.nameSimilarity ?? 0) >= 0.35) return "medium";
  return "low";
}

export function duplicateSuggestedAction(signals: DuplicateCandidateSignals): DuplicateCandidateSuggestedAction {
  const confidence = duplicateConfidence(signals);
  if (identityReviewOnly(signals)) return "manual_duplicate_review";
  if (shouldHoldDuplicateReview(signals, confidence)) return "hold_duplicate_review";
  if (confidence === "high" && hasStrongIdentityEvidence(signals)) return "update_existing";
  return "manual_duplicate_review";
}

export function duplicateRelationshipHint(signals: DuplicateCandidateSignals): DuplicateCandidateRelationshipHint {
  if (signals.externalRefsMatch || signals.kakaoPlaceIdMatch) return null;
  if (signals.sameBuildingReviewOnly) return "same_building";
  if (signals.publicSubfacilityReviewOnly && (signals.addressMatch || signals.sameSigunguMatch)) return "parent_child";
  return null;
}

export function duplicateOutsideRadiusReviewOnly(signals: DuplicateCandidateSignals) {
  return Boolean(
    signals.radiusMeters !== null &&
      signals.radiusMeters !== undefined &&
      signals.distanceMeters !== null &&
      signals.distanceMeters > signals.radiusMeters &&
      !signals.addressMatch &&
      !signals.externalRefsMatch &&
      !signals.kakaoPlaceIdMatch
  );
}

export function duplicateGenericBranchName(inputName: string, candidateName: string) {
  const input = compactDuplicateText(inputName);
  const candidate = compactDuplicateText(candidateName);
  return genericBranchNameTerms.some((term) => input.includes(term) && candidate.includes(term));
}

export function duplicateBranchSiblingReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  return branchSiblingReviewTerms.some((term) => input.includes(term) && candidate.includes(term));
}

export function duplicateLodgingClusterReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  const [shorter, longer] = input.length <= candidate.length ? [input, candidate] : [candidate, input];
  if (longer.includes(shorter)) return false;

  const sharedTerms = lodgingClusterReviewTerms.filter((term) => input.includes(term) && candidate.includes(term));
  return sharedTerms.length >= 2 || sharedTerms.some((term) => term === "키즈풀빌라" || term === "키즈펜션" || term === "가족펜션");
}

export function duplicateWeakThematicSimilarityReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  return genericActivityTerms.some((term) => input.includes(term) && candidate.includes(term));
}

export function duplicateSameBuildingReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  const [shorter, longer] = input.length <= candidate.length ? [input, candidate] : [candidate, input];
  if (shorter.length >= 5 && longer.includes(shorter)) {
    return longer.length - shorter.length >= 3;
  }

  return sharedRetailParentBuildingAnchor(input, candidate) !== null;
}

export function duplicatePublicSubfacilityReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  const inputTerms = publicChildSubfacilityTerms.filter((term) => input.includes(term));
  const candidateTerms = publicChildSubfacilityTerms.filter((term) => candidate.includes(term));
  if (inputTerms.length === 0 || candidateTerms.length === 0) return false;

  return !inputTerms.some((term) => candidateTerms.includes(term));
}

export function duplicateGenericAliasReviewOnly(
  inputName: string,
  inputAliases: string[] | undefined,
  candidateName: string,
  candidateAliases: string[] | undefined,
  candidateTags: string[] | undefined
) {
  const inputTexts = [inputName, ...(inputAliases ?? [])].map(compactDuplicateName).filter(Boolean);
  const candidateTexts = [candidateName, ...(candidateAliases ?? []), ...(candidateTags ?? [])].map(compactDuplicateName).filter(Boolean);
  if (inputTexts.length === 0 || candidateTexts.length === 0) return false;

  return publicGenericAliasReviewTerms.some(
    (term) => inputTexts.some((text) => text.includes(term)) && candidateTexts.some((text) => text.includes(term))
  );
}

export function duplicateSameSidoGenericReviewOnly(
  inputName: string,
  candidateName: string,
  signals: Pick<DuplicateCandidateSignals, "regionMatch" | "sameSigunguMatch" | "distanceMeters" | "radiusMeters">
) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;
  if (!signals.regionMatch || signals.sameSigunguMatch) return false;

  const isOutsideRequestedRadius = Boolean(
    signals.radiusMeters !== null &&
      signals.radiusMeters !== undefined &&
      signals.distanceMeters !== null &&
      signals.distanceMeters > signals.radiusMeters
  );
  if (!isOutsideRequestedRadius && signals.distanceMeters !== null) return false;

  return publicInstitutionGenericTerms.some((term) => input.includes(term) && candidate.includes(term));
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

function shouldHoldDuplicateReview(signals: DuplicateCandidateSignals, confidence: string) {
  if (identityReviewOnly(signals)) return false;
  if (genericPublicFacilityNoiseReviewOnly(signals)) return false;
  if (duplicateOutsideRadiusReviewOnly(signals)) return true;
  if (signals.sameSidoGenericReviewOnly && !hasStrongIdentityEvidence(signals)) return true;
  if (signals.genericBranchName && signals.addressRegionConflict && !hasStrongIdentityEvidence(signals)) return true;
  return confidence === "low" && Boolean(signals.aliasMatch) && !hasStrongIdentityEvidence(signals);
}

function hasStrongIdentityEvidence(signals: DuplicateCandidateSignals) {
  return Boolean(
    signals.externalRefsMatch ||
      signals.kakaoPlaceIdMatch ||
      signals.addressMatch ||
      signals.sameSigunguMatch ||
      (signals.distanceMeters !== null && signals.distanceMeters <= 150 && (signals.nameSimilarity ?? 0) >= 0.85)
  );
}

function identityReviewOnly(signals: DuplicateCandidateSignals) {
  return Boolean(
    (signals.sameBuildingReviewOnly ||
      signals.branchSiblingReviewOnly ||
      signals.lodgingClusterReviewOnly ||
      signals.weakThematicSimilarityReviewOnly ||
      signals.genericAliasReviewOnly) &&
      !signals.externalRefsMatch &&
      !signals.kakaoPlaceIdMatch &&
      !hasStrongIdentityEvidence(signals)
  );
}

function genericPublicFacilityNoiseReviewOnly(signals: DuplicateCandidateSignals) {
  return Boolean(
    signals.sameSidoGenericReviewOnly &&
      !hasStrongIdentityEvidence(signals) &&
      (signals.addressRegionConflict || signals.publicSubfacilityReviewOnly || duplicateOutsideRadiusReviewOnly(signals))
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

function compactDuplicateName(value: string) {
  return compactDuplicateText(value).replace(/점$/, "");
}

function sharedRetailParentBuildingAnchor(input: string, candidate: string) {
  let best: string | null = null;
  for (let start = 0; start < input.length; start += 1) {
    for (let end = start + 5; end <= input.length; end += 1) {
      const part = input.slice(start, end);
      if (!candidate.includes(part)) continue;
      if (!retailParentBuildingTerms.some((term) => part.includes(term))) continue;
      if (!best || part.length > best.length) best = part;
    }
  }
  return best;
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

const branchSiblingReviewTerms = [
  "롯데몰",
  "롯데백화점",
  "롯데프리미엄아울렛",
  "현대백화점",
  "현대프리미엄아울렛",
  "신세계백화점",
  "스타필드",
  "스타필드시티",
  "타임빌라스",
  "토이저러스",
  "레고스토어",
  "이마트",
  "홈플러스",
  "트레이더스"
].map(compactDuplicateText);

const retailParentBuildingTerms = [
  "신세계",
  "롯데몰",
  "롯데백화점",
  "롯데프리미엄아울렛",
  "현대백화점",
  "현대프리미엄아울렛",
  "스타필드",
  "스타필드시티",
  "타임빌라스",
  "이마트",
  "홈플러스",
  "트레이더스"
].map(compactDuplicateText);

const lodgingClusterReviewTerms = ["키즈풀빌라", "키즈펜션", "가족펜션", "풀빌라", "펜션", "리조트", "키즈"].map(compactDuplicateText);

const publicInstitutionGenericTerms = [
  "교육문화원",
  "육아종합지원센터",
  "공동육아나눔터",
  "아이사랑놀이터",
  "장난감도서관",
  "어린이도서관",
  "청소년수련관",
  "가족센터",
  "문화원",
  "도서관"
].map(compactDuplicateText);

const publicGenericAliasReviewTerms = Array.from(
  new Set(
    [
      ...publicInstitutionGenericTerms,
      "어린이자료실",
      "유아자료실",
      "가족열람실",
      "장난감나라",
      "장난감대여실",
      "공동육아방",
      "놀이체험실",
      "어린이체험실",
      "실내놀이터"
    ].map(compactDuplicateText)
  )
);

const publicChildSubfacilityTerms = [
  "서울형키즈카페",
  "아이세상놀이터",
  "아이사랑놀이터",
  "공동육아방",
  "공동육아나눔터",
  "장난감도서관",
  "나누리장난감도서관",
  "육아종합지원센터",
  "어린이집",
  "어린이도서관"
].map(compactDuplicateText);

const genericActivityTerms = [
  "물놀이터",
  "분수",
  "수영장",
  "어린이자료실",
  "장난감도서관",
  "어린이체험실",
  "체험실"
].map(compactDuplicateText);

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
