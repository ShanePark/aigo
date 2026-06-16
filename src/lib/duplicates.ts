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
  publicSameSiteSubfacilityReviewOnly?: boolean;
  publicProviderSiblingReviewOnly?: boolean;
  sameBuildingReviewOnly?: boolean;
  tenantParentReviewOnly?: boolean;
  sameSidoGenericReviewOnly?: boolean;
  unrelatedBranchCategoryReviewOnly?: boolean;
  categoryConflictReviewOnly?: boolean;
  sameSigunguMatch?: boolean;
  externalRefsMatch: boolean;
  kakaoPlaceIdMatch: boolean;
  distanceMeters: number | null;
  nameSimilarity: number | null;
  radiusMeters?: number | null;
};

export type DuplicateCandidateSuggestedAction = "update_existing" | "manual_duplicate_review" | "hold_duplicate_review";
export type DuplicateCandidateRelationshipHint = "same_building" | "parent_child" | null;
export type DuplicateCandidateReviewBucket = "identity" | "relationship_context" | "sibling_branch_review" | "low_priority_noise";

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

  if (signals.publicSameSiteSubfacilityReviewOnly) {
    reasonCodes.push("PUBLIC_SAME_SITE_SUBFACILITY_REVIEW_ONLY");
  }

  if (signals.publicProviderSiblingReviewOnly) {
    reasonCodes.push("PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY");
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

  if (signals.tenantParentReviewOnly) {
    reasonCodes.push("TENANT_PARENT_REVIEW_ONLY");
  }

  if (signals.sameSidoGenericReviewOnly) {
    reasonCodes.push("SAME_SIDO_GENERIC_REVIEW_ONLY");
  }

  if (signals.unrelatedBranchCategoryReviewOnly) {
    reasonCodes.push("UNRELATED_BRANCH_CATEGORY_REVIEW_ONLY");
  }

  if (signals.categoryConflictReviewOnly) {
    reasonCodes.push("CATEGORY_CONFLICT_REVIEW_ONLY");
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
  if (signals.unrelatedBranchCategoryReviewOnly && !signals.externalRefsMatch && !signals.kakaoPlaceIdMatch) {
    return signals.addressMatch || (signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 500 ? "medium" : "low";
  }
  if (signals.categoryConflictReviewOnly && !signals.externalRefsMatch && !signals.kakaoPlaceIdMatch) {
    if (signals.distanceMeters !== null && signals.distanceMeters <= 150 && (signals.nameSimilarity ?? 0) >= 0.85) return "high";
    return signals.addressMatch || (signals.distanceMeters ?? Number.POSITIVE_INFINITY) <= 1000 ? "medium" : "low";
  }
  if (signals.publicProviderSiblingReviewOnly && !hasStrongIdentityEvidence(signals)) return "low";
  if (signals.publicSameSiteSubfacilityReviewOnly) return "medium";
  if (signals.publicSubfacilityReviewOnly) return "medium";
  if (signals.tenantParentReviewOnly) return "medium";
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
  if (signals.unrelatedBranchCategoryReviewOnly && !signals.externalRefsMatch && !signals.kakaoPlaceIdMatch) return "manual_duplicate_review";
  if (signals.categoryConflictReviewOnly && !signals.externalRefsMatch && !signals.kakaoPlaceIdMatch) return "manual_duplicate_review";
  if (identityReviewOnly(signals)) return "manual_duplicate_review";
  if (shouldHoldDuplicateReview(signals, confidence)) return "hold_duplicate_review";
  if (confidence === "high" && hasStrongIdentityEvidence(signals)) return "update_existing";
  return "manual_duplicate_review";
}

export function duplicateRelationshipHint(signals: DuplicateCandidateSignals): DuplicateCandidateRelationshipHint {
  if (signals.externalRefsMatch || signals.kakaoPlaceIdMatch) return null;
  if (signals.tenantParentReviewOnly) return "same_building";
  if (signals.sameBuildingReviewOnly) return "same_building";
  if ((signals.publicSubfacilityReviewOnly || signals.publicSameSiteSubfacilityReviewOnly) && (signals.addressMatch || signals.sameSigunguMatch)) {
    return "parent_child";
  }
  return null;
}

export function duplicateReviewBucket(signals: DuplicateCandidateSignals): DuplicateCandidateReviewBucket {
  if (signals.externalRefsMatch || signals.kakaoPlaceIdMatch) return "identity";
  if (
    signals.sameBuildingReviewOnly ||
    signals.tenantParentReviewOnly ||
    signals.publicSameSiteSubfacilityReviewOnly ||
    (signals.publicSubfacilityReviewOnly && !publicSubfacilityRegionConflictNoise(signals))
  ) {
    return "relationship_context";
  }
  if (
    signals.branchSiblingReviewOnly ||
    signals.publicProviderSiblingReviewOnly ||
    (signals.genericAliasReviewOnly && !hasStrongIdentityEvidence(signals) && (signals.addressRegionConflict || duplicateOutsideRadiusReviewOnly(signals)))
  ) {
    return "sibling_branch_review";
  }
  if (
    signals.unrelatedBranchCategoryReviewOnly ||
    signals.categoryConflictReviewOnly ||
    publicSubfacilityRegionConflictNoise(signals) ||
    lowConfidenceLocationConflictNoise(signals) ||
    signals.weakThematicSimilarityReviewOnly ||
    signals.sameSidoGenericReviewOnly ||
    (signals.genericBranchName && !hasStrictLocationMatch(signals))
  ) {
    return "low_priority_noise";
  }
  return "identity";
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

export function duplicateTenantParentReviewOnly(
  inputName: string,
  inputCategory: string | null | undefined,
  candidateName: string,
  candidateCategory: string | null | undefined
) {
  if (inputCategory !== "toy_store" || candidateCategory !== "shopping_mall") return false;
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;
  if (candidate.includes(input)) return false;

  const inputHasToyTenant = toyStoreTenantTerms.some((term) => input.includes(term));
  const candidateHasToyTenant = toyStoreTenantTerms.some((term) => candidate.includes(term));
  return inputHasToyTenant && !candidateHasToyTenant;
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

export function duplicatePublicSameSiteSubfacilityReviewOnly(
  inputName: string,
  inputCategory: string | null | undefined,
  candidateName: string,
  candidateCategory: string | null | undefined
) {
  if (!inputCategory || !candidateCategory || inputCategory === candidateCategory) return false;
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  if (parkPlaygroundSameSiteReviewOnly(input, inputCategory, candidate, candidateCategory)) return true;

  const sharedProvider = publicSameSiteSubfacilityProviderTerms.some((term) => input.includes(term) && candidate.includes(term));
  if (!sharedProvider) return false;

  const inputSubfacility = publicSameSiteSubfacilityServiceTerms.some((term) => input.includes(term));
  const candidateSubfacility = publicSameSiteSubfacilityServiceTerms.some((term) => candidate.includes(term));
  return inputSubfacility || candidateSubfacility || publicSameSiteSubfacilityCategories.has(inputCategory) || publicSameSiteSubfacilityCategories.has(candidateCategory);
}

export function duplicatePublicProviderSiblingReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  const sharedProvider = publicProviderSiblingProviderTerms.some((term) => input.includes(term) && candidate.includes(term));
  const sharedService = publicProviderSiblingServiceTerms.some((term) => input.includes(term) && candidate.includes(term));
  if (!sharedProvider || !sharedService) return false;

  return hasDifferentBranchToken(input, candidate) || hasDifferentSharedChildcareBranchToken(input, candidate);
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

export function duplicateUnrelatedBranchCategoryReviewOnly(inputName: string, candidateName: string) {
  const input = compactDuplicateName(inputName);
  const candidate = compactDuplicateName(candidateName);
  if (!input || !candidate || input === candidate) return false;

  const inputHasFoodBranchTerm = genericBranchNameTerms.some((term) => input.includes(term));
  const candidateHasFoodBranchTerm = genericBranchNameTerms.some((term) => candidate.includes(term));
  return candidateHasFoodBranchTerm && !inputHasFoodBranchTerm;
}

export function duplicateCategoryConflictReviewOnly(inputCategory?: string | null, candidateCategory?: string | null) {
  if (!inputCategory || !candidateCategory || inputCategory === candidateCategory) return false;

  return (
    (publicChildcareSubfacilityCategories.has(inputCategory) && broadDestinationCategories.has(candidateCategory)) ||
    (publicChildcareSubfacilityCategories.has(candidateCategory) && broadDestinationCategories.has(inputCategory))
  );
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
  if (publicSubfacilityRegionConflictNoise(signals)) return false;
  if (signals.publicProviderSiblingReviewOnly && !hasStrongIdentityEvidence(signals)) return false;
  if (lowConfidenceLocationConflictNoise(signals)) return false;
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
      (signals.sameSigunguMatch && !signals.publicProviderSiblingReviewOnly) ||
      (signals.distanceMeters !== null && signals.distanceMeters <= 150 && (signals.nameSimilarity ?? 0) >= 0.85)
  );
}

function identityReviewOnly(signals: DuplicateCandidateSignals) {
  return Boolean(
    (signals.sameBuildingReviewOnly ||
      signals.tenantParentReviewOnly ||
      signals.branchSiblingReviewOnly ||
      signals.lodgingClusterReviewOnly ||
      signals.weakThematicSimilarityReviewOnly ||
      signals.genericAliasReviewOnly ||
      signals.publicSameSiteSubfacilityReviewOnly ||
      signals.categoryConflictReviewOnly ||
      signals.publicProviderSiblingReviewOnly) &&
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

function publicSubfacilityRegionConflictNoise(signals: DuplicateCandidateSignals) {
  return Boolean(signals.publicSubfacilityReviewOnly && signals.addressRegionConflict && !hasStrongIdentityEvidence(signals));
}

function lowConfidenceLocationConflictNoise(signals: DuplicateCandidateSignals) {
  return Boolean(
    signals.addressRegionConflict &&
      duplicateOutsideRadiusReviewOnly(signals) &&
      !hasStrongIdentityEvidence(signals)
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

function hasDifferentBranchToken(input: string, candidate: string) {
  const inputTokens = branchTokens(input);
  const candidateTokens = branchTokens(candidate);
  if (inputTokens.length === 0 || candidateTokens.length === 0) return false;
  return !inputTokens.some((token) => candidateTokens.includes(token));
}

function hasDifferentSharedChildcareBranchToken(input: string, candidate: string) {
  const inputToken = sharedChildcareBranchToken(input);
  const candidateToken = sharedChildcareBranchToken(candidate);
  if (!inputToken || !candidateToken) return false;
  return inputToken !== candidateToken;
}

function sharedChildcareBranchToken(value: string) {
  for (const serviceTerm of sharedChildcareSiblingServiceTerms) {
    const serviceIndex = value.indexOf(serviceTerm);
    if (serviceIndex < 0) continue;
    const beforeService = value.slice(0, serviceIndex);
    const afterService = value.slice(serviceIndex + serviceTerm.length);
    const token = normalizeSharedChildcareBranchToken(`${beforeService}${afterService}`);
    if (token) return token;
  }
  return null;
}

function normalizeSharedChildcareBranchToken(value: string) {
  return value
    .replace(/(?:공동육아|나눔터|센터|지점|분소|본점|본관|별관|점)$/g, "")
    .replace(/(?:제)?(\d+)호점?/g, "$1호")
    .replace(/[^가-힣a-z0-9]+/gi, "");
}

function branchTokens(value: string) {
  const tokens = new Set<string>();

  for (const provider of publicProviderSiblingProviderTerms) {
    const providerIndex = value.indexOf(provider);
    if (providerIndex < 0) continue;
    const tail = value.slice(providerIndex + provider.length);
    const branchMatch = tail.match(/^([가-힣A-Za-z0-9]{2,8})점/);
    if (branchMatch?.[1]) tokens.add(compactDuplicateText(branchMatch[1]));
  }

  return Array.from(tokens).filter(
    (token) => !publicProviderSiblingGenericBranchTokens.some((generic) => token.includes(generic) || generic.includes(token))
  );
}

function parkPlaygroundSameSiteReviewOnly(input: string, inputCategory: string, candidate: string, candidateCategory: string) {
  const categoryPair = new Set([inputCategory, candidateCategory]);
  if (!categoryPair.has("park") || !categoryPair.has("playground")) return false;
  if (!input.includes("공원") || !candidate.includes("공원")) return false;

  const inputHasPlayground = publicSameSiteSubfacilityServiceTerms.some((term) => input.includes(term));
  const candidateHasPlayground = publicSameSiteSubfacilityServiceTerms.some((term) => candidate.includes(term));
  if (!inputHasPlayground && !candidateHasPlayground) return false;

  const inputAnchors = parkSiteAnchors(input);
  const candidateAnchors = parkSiteAnchors(candidate);
  return inputAnchors.some((anchor) => candidateAnchors.includes(anchor));
}

function parkSiteAnchors(value: string) {
  const anchors = new Set<string>();
  const parkIndex = value.indexOf("공원");
  if (parkIndex > 0) {
    const beforePark = value.slice(0, parkIndex);
    let trimmedBeforePark = beforePark;
    let trimmed = true;
    while (trimmed) {
      trimmed = false;
      for (const suffix of parkGenericSiteAnchors) {
        if (trimmedBeforePark.endsWith(suffix)) {
          trimmedBeforePark = trimmedBeforePark.slice(0, -suffix.length);
          trimmed = true;
        }
      }
    }
    if (trimmedBeforePark.length >= 2) anchors.add(trimmedBeforePark);
    for (const suffixLength of [4, 3, 2]) {
      if (beforePark.length >= suffixLength) anchors.add(beforePark.slice(-suffixLength));
    }
  }
  return Array.from(anchors).filter((anchor) => anchor.length >= 2 && !parkGenericSiteAnchors.has(anchor));
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
  "교통문화연수원",
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
  "실내놀이터",
  "나누리장난감도서관",
  "육아종합지원센터",
  "어린이집",
  "어린이도서관"
].map(compactDuplicateText);

const publicChildcareSubfacilityCategories = new Set(["shared_childcare", "toy_library"]);

const publicSameSiteSubfacilityCategories = new Set(["shared_childcare", "toy_library", "indoor_playground", "experience_center", "library"]);

const publicSameSiteSubfacilityProviderTerms = [
  "육아종합지원센터",
  "가족센터",
  "공동육아나눔터",
  "아이사랑놀이터",
  "어린이도서관",
  "도서관"
].map(compactDuplicateText);

const publicSameSiteSubfacilityServiceTerms = [
  "장난감대여실",
  "장난감도서관",
  "장난감나라",
  "공동육아방",
  "공동육아나눔터",
  "실내놀이터",
  "체험관",
  "체험실",
  "놀이방",
  "놀이터",
  "키즈카페",
  "자료실"
].map(compactDuplicateText);

const parkGenericSiteAnchors = new Set(["어린이", "근린", "문화", "체육", "시민", "웰빙", "테마"].map(compactDuplicateText));

const toyStoreTenantTerms = ["토이저러스", "토이플러스", "레고스토어", "장난감가게", "완구점", "완구매장"].map(compactDuplicateText);

const broadDestinationCategories = new Set([
  "experience_center",
  "museum",
  "science_museum",
  "aquarium",
  "zoo",
  "park",
  "playground",
  "shopping_mall",
  "accommodation",
  "family_restaurant",
  "family_cafe",
  "sports_venue",
  "rest_area"
]);

const publicProviderSiblingProviderTerms = [
  "육아종합지원센터",
  "가족센터",
  "도서관",
  "어린이도서관",
  "공동육아나눔터",
  "아이사랑놀이터"
].map(compactDuplicateText);

const publicProviderSiblingServiceTerms = [
  "장난감도서관",
  "장난감나라",
  "장난감대여실",
  "나누리장난감도서관",
  "공동육아나눔터",
  "공동육아방",
  "실내놀이터",
  "어린이자료실",
  "유아자료실"
].map(compactDuplicateText);

const sharedChildcareSiblingServiceTerms = ["공동육아나눔터", "공동육아방"].map(compactDuplicateText);

const publicProviderSiblingGenericBranchTokens = [
  "육아종합지원",
  "육아종합지원센터",
  "장난감도서",
  "나누리장난감도서",
  "어린이도서",
  "공동육아",
  "아이사랑",
  "실내놀이터",
  "자료실"
].map(compactDuplicateText);

const genericActivityTerms = [
  "물놀이터",
  "분수",
  "수영장",
  "교통안전체험",
  "안전체험",
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
