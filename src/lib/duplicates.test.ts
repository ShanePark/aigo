import { describe, expect, it } from "vitest";

import {
  duplicateCategoryConflictReviewOnly,
  duplicateConfidence,
  duplicateBranchSiblingReviewOnly,
  duplicateGenericAliasReviewOnly,
  duplicateGenericBranchName,
  duplicateLocationSignals,
  duplicateLodgingClusterReviewOnly,
  duplicateOutsideRadiusReviewOnly,
  duplicatePublicProviderSiblingReviewOnly,
  duplicatePublicSameSiteSubfacilityReviewOnly,
  duplicatePublicSubfacilityReviewOnly,
  duplicateReasonCodes,
  duplicateRelationshipHint,
  duplicateReviewBucket,
  duplicateSameBuildingReviewOnly,
  duplicateSameSidoGenericReviewOnly,
  duplicateSuggestedAction,
  duplicateTenantParentReviewOnly,
  duplicateUnrelatedBranchCategoryReviewOnly,
  duplicateWeakThematicSimilarityReviewOnly
} from "@/lib/duplicates";

describe("duplicate helpers", () => {
  it("treats kakao place id match as high confidence", () => {
    const signals = {
      aliasMatch: false,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: true,
      distanceMeters: 2000,
      nameSimilarity: 0.1
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toContain("KAKAO_PLACE_ID_MATCH");
  });

  it("treats external reference matches as high confidence", () => {
    const signals = {
      aliasMatch: false,
      externalRefsMatch: true,
      kakaoPlaceIdMatch: false,
      distanceMeters: 3000,
      nameSimilarity: 0.1
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toContain("EXTERNAL_REF_MATCH");
  });

  it("does not mark same-name far-away places as high confidence without external id", () => {
    const signals = {
      aliasMatch: false,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 8000,
      nameSimilarity: 0.9,
      radiusMeters: 800
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateReasonCodes(signals)).toContain("NAME_SIMILAR");
    expect(duplicateReasonCodes(signals)).toContain("GEO_OUTSIDE_REQUEST_RADIUS");
    expect(duplicateReasonCodes(signals)).toContain("OUTSIDE_RADIUS_REVIEW_ONLY");
    expect(duplicateReasonCodes(signals)).not.toContain("GEO_NEAR");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
  });

  it("downgrades outside-radius alias and region matches to low-priority review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 5600,
      nameSimilarity: 0.72,
      radiusMeters: 500
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ALIAS_MATCH", "REGION_MATCH", "GEO_OUTSIDE_REQUEST_RADIUS", "OUTSIDE_RADIUS_REVIEW_ONLY", "NAME_SIMILAR"]));
  });

  it("keeps outside-radius location-conflict noise as manual review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      addressRegionConflict: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 6100,
      nameSimilarity: 0.62,
      radiusMeters: 800
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "REGION_MATCH",
        "ADDRESS_REGION_CONFLICT",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps high-similarity outside-radius address conflicts non-blocking", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      addressRegionConflict: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 3824,
      nameSimilarity: 0.9,
      radiusMeters: 50
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "REGION_MATCH",
        "ADDRESS_REGION_CONFLICT",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps same-address outside-radius candidates as possible duplicates", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 5600,
      nameSimilarity: 0.72,
      radiusMeters: 500
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(false);
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
  });

  it("keeps same-building substring matches below high confidence", () => {
    const signals = {
      aliasMatch: false,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.65
    };

    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateReasonCodes(signals)).toEqual(["GEO_NEAR", "NAME_SIMILAR"]);
  });

  it("treats nearby alias matches as high confidence", () => {
    const signals = {
      aliasMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 420,
      nameSimilarity: 0.12
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toContain("ALIAS_MATCH");
  });

  it("does not treat far alias matches as high confidence", () => {
    const signals = {
      aliasMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 5000,
      nameSimilarity: 0.12
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("hold_duplicate_review");
    expect(duplicateReasonCodes(signals)).toContain("ALIAS_MATCH");
  });

  it("treats same-address name matches as high confidence without coordinates", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.7
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toContain("ADDRESS_MATCH");
  });

  it("keeps same-building parent and tenant matches at review confidence", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.72,
      sameBuildingReviewOnly: true
    };

    expect(duplicateSameBuildingReviewOnly("챔피언 스타필드 시티 명지", "스타필드 시티 명지")).toBe(true);
    expect(duplicateSameBuildingReviewOnly("스타필드 시티 명지점", "스타필드 시티 명지")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction({ ...signals, aliasMatch: true })).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("same_building");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ADDRESS_MATCH", "SAME_BUILDING_REVIEW_ONLY", "GEO_NEAR"]));
  });

  it("keeps same parent-building tenant siblings as manual review", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 120,
      nameSimilarity: 0.72,
      sameBuildingReviewOnly: true
    };

    expect(duplicateSameBuildingReviewOnly("주라지 테마파크 대구신세계", "리틀란드 대구신세계")).toBe(true);
    expect(duplicateSameBuildingReviewOnly("주라지 테마파크 대구신세계", "대구 이월드")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("same_building");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ALIAS_MATCH", "ADDRESS_MATCH", "SAME_BUILDING_REVIEW_ONLY", "GEO_NEAR", "NAME_SIMILAR"]));
  });

  it("keeps toy-store tenant candidates separate from parent shopping mall identity", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.72,
      tenantParentReviewOnly: true
    };

    expect(duplicateTenantParentReviewOnly("토이저러스 동부산점", "toy_store", "롯데프리미엄아울렛 동부산점", "shopping_mall")).toBe(true);
    expect(duplicateTenantParentReviewOnly("토이저러스 동부산점", "toy_store", "토이저러스 동부산점", "shopping_mall")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("same_building");
    expect(duplicateReviewBucket(signals)).toBe("relationship_context");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["TENANT_PARENT_REVIEW_ONLY", "ALIAS_MATCH", "ADDRESS_MATCH", "GEO_NEAR", "NAME_SIMILAR"]));
  });

  it("keeps chain branch siblings as manual review instead of blocking or updating", () => {
    const signals = {
      aliasMatch: true,
      branchSiblingReviewOnly: true,
      addressRegionConflict: true,
      regionMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.82
    };

    expect(duplicateBranchSiblingReviewOnly("스타필드 시티 부천", "스타필드 안성")).toBe(true);
    expect(duplicateBranchSiblingReviewOnly("스타필드 시티 부천", "스타필드 시티 부천")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "BRANCH_SIBLING_REVIEW_ONLY", "REGION_MATCH", "ADDRESS_REGION_CONFLICT", "NAME_SIMILAR"])
    );
  });

  it("lets external references override branch sibling review cautions", () => {
    const signals = {
      aliasMatch: true,
      branchSiblingReviewOnly: true,
      externalRefsMatch: true,
      kakaoPlaceIdMatch: false,
      distanceMeters: 8000,
      nameSimilarity: 0.82
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
  });

  it("keeps nearby kid-primary lodging clusters as manual review without strict identity evidence", () => {
    const signals = {
      aliasMatch: true,
      lodgingClusterReviewOnly: true,
      regionMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 370,
      radiusMeters: 500,
      nameSimilarity: 0.72
    };

    expect(duplicateLodgingClusterReviewOnly("여수 유키즈풀빌라", "라비주키즈앤풀빌라")).toBe(true);
    expect(duplicateLodgingClusterReviewOnly("여수 하이맘키즈가족펜션골드", "여수 하이맘 키즈 가족 펜션 골드")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ALIAS_MATCH", "LODGING_CLUSTER_REVIEW_ONLY", "REGION_MATCH", "GEO_NEAR", "NAME_SIMILAR"]));
  });

  it("lets strong identity evidence override lodging cluster review cautions", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      lodgingClusterReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 120,
      nameSimilarity: 0.72
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
  });

  it("keeps different public childcare subfacilities at review confidence", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      publicSubfacilityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.55,
      radiusMeters: 500
    };

    expect(
      duplicatePublicSubfacilityReviewOnly(
        "서울형 키즈카페 금천구 아이세상놀이터점",
        "금천구육아종합지원센터 나누리장난감도서관 독산점"
      )
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("parent_child");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ADDRESS_MATCH", "PUBLIC_SUBFACILITY_REVIEW_ONLY", "GEO_NEAR", "NAME_SIMILAR"])
    );
  });

  it("keeps same-site public subfacilities with distinct categories as relationship review", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      publicSameSiteSubfacilityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.74,
      radiusMeters: 250
    };

    expect(
      duplicatePublicSameSiteSubfacilityReviewOnly(
        "익산시서부권육아종합지원센터 노리뜨락체험관",
        "experience_center",
        "익산시서부권육아종합지원센터 꿈뜨락 장난감대여실",
        "toy_library"
      )
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("parent_child");
    expect(duplicateReviewBucket(signals)).toBe("relationship_context");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "PUBLIC_SAME_SITE_SUBFACILITY_REVIEW_ONLY", "ADDRESS_MATCH", "GEO_NEAR", "NAME_SIMILAR"])
    );
  });

  it("keeps source-backed park playground candidates as relationship review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      sameSigunguMatch: true,
      publicSameSiteSubfacilityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 120,
      nameSimilarity: 0.61,
      radiusMeters: 500
    };

    expect(
      duplicatePublicSameSiteSubfacilityReviewOnly("우산공원 꿈트리놀이터", "playground", "우산 웰빙테마공원", "park")
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("parent_child");
    expect(duplicateReviewBucket(signals)).toBe("relationship_context");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "PUBLIC_SAME_SITE_SUBFACILITY_REVIEW_ONLY",
        "REGION_MATCH",
        "GEO_NEAR",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps same-provider toy-library sibling branches from blocking enrichment", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      sameSigunguMatch: true,
      publicProviderSiblingReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 2400,
      nameSimilarity: 0.82,
      radiusMeters: 500
    };

    expect(
      duplicatePublicProviderSiblingReviewOnly(
        "광명시육아종합지원센터 소하점 장난감도서관",
        "광명시육아종합지원센터 하안점 장난감도서관"
      )
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "REGION_MATCH",
        "PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps shared-childcare sibling branches as manual review instead of hard hold", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      sameSigunguMatch: true,
      publicProviderSiblingReviewOnly: true,
      genericAliasReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 1700,
      nameSimilarity: 0.76,
      radiusMeters: 500
    };

    expect(duplicatePublicProviderSiblingReviewOnly("김제시 공동육아나눔터 1호점", "김제시 별빛공동육아나눔터")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("완주군 용진공동육아나눔터", "완주군 삼봉공동육아나눔터")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("완주군 삼봉공동육아나눔터", "완주군 삼봉공동육아나눔터")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("sibling_branch_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "GENERIC_ALIAS_REVIEW_ONLY",
        "PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY",
        "REGION_MATCH",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps 서울형 키즈카페 branch-token mismatches out of identity review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      publicProviderSiblingReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.82,
      radiusMeters: null
    };

    expect(duplicatePublicProviderSiblingReviewOnly("서울형 키즈카페 구로구 오류1동점", "서울형 키즈카페 구로구 개봉1동점")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("서울형 키즈카페 오류1동점", "서울형 키즈카페 구로구 개봉1동점")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("서울형 키즈카페 개봉1동점", "서울형 키즈카페 구로구 개봉1동점")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("sibling_branch_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY", "REGION_MATCH", "NAME_SIMILAR"])
    );
  });

  it("keeps 아이사랑꿈터 numbered sibling branches from blocking create preflight", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      sameSigunguMatch: true,
      publicProviderSiblingReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 4209,
      nameSimilarity: 0.86,
      radiusMeters: 500
    };

    expect(duplicatePublicProviderSiblingReviewOnly("아이사랑꿈터 서구 2호점", "아이사랑꿈터 서구 11호점")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("아이사랑꿈터 계양구 2호점", "아이사랑꿈터 계양구 1호점")).toBe(true);
    expect(duplicatePublicProviderSiblingReviewOnly("아이사랑꿈터 계양구 2호점", "아이사랑꿈터 계양구 2호점")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("sibling_branch_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY",
        "REGION_MATCH",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("downgrades outside-radius public provider siblings outside the source district", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      sameSigunguMatch: false,
      publicProviderSiblingReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 48000,
      nameSimilarity: 0.72,
      radiusMeters: 500
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "PUBLIC_PROVIDER_SIBLING_REVIEW_ONLY",
        "REGION_MATCH",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps public childcare candidates from merging into nearby broad attractions", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      categoryConflictReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 714,
      radiusMeters: 1200,
      nameSimilarity: 0.72
    };

    expect(duplicateCategoryConflictReviewOnly("shared_childcare", "experience_center")).toBe(true);
    expect(duplicateCategoryConflictReviewOnly("shared_childcare", "shared_childcare")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "REGION_MATCH", "CATEGORY_CONFLICT_REVIEW_ONLY", "NAME_SIMILAR"])
    );
  });

  it("keeps public childcare candidates from merging into nearby related facility categories", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      categoryConflictReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 364,
      radiusMeters: 500,
      nameSimilarity: 0.72
    };

    expect(duplicateCategoryConflictReviewOnly("shared_childcare", "toy_library")).toBe(true);
    expect(duplicateCategoryConflictReviewOnly("shared_childcare", "kids_cafe")).toBe(true);
    expect(duplicateCategoryConflictReviewOnly("shared_childcare", "indoor_playground")).toBe(true);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "REGION_MATCH", "CATEGORY_CONFLICT_REVIEW_ONLY", "GEO_NEAR", "NAME_SIMILAR"])
    );
  });

  it("lets strict identity evidence override public provider sibling cautions", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      publicProviderSiblingReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.88,
      radiusMeters: 500
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
  });

  it("does not mark matching public childcare subfacility terms as review-only", () => {
    expect(
      duplicatePublicSubfacilityReviewOnly(
        "서울형 키즈카페 금천구 아이세상놀이터점",
        "금천구 아이세상놀이터"
      )
    ).toBe(false);
  });

  it("keeps same-building public childcare siblings as manual review even with generic aliases", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      publicSubfacilityReviewOnly: true,
      genericAliasReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 0.72,
      radiusMeters: 500
    };

    expect(
      duplicatePublicSubfacilityReviewOnly(
        "광주광역시육아종합지원센터 키움뜰 실내놀이터",
        "키움뜰장난감도서관"
      )
    ).toBe(true);
    expect(
      duplicateGenericAliasReviewOnly(
        "광주광역시육아종합지원센터 키움뜰 실내놀이터",
        ["광주광역시육아종합지원센터", "키움뜰 실내놀이터"],
        "키움뜰장난감도서관",
        ["광주육아종합지원센터 키움뜰장난감도서관"],
        ["육아종합지원센터", "장난감도서관"]
      )
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBe("parent_child");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "GENERIC_ALIAS_REVIEW_ONLY", "PUBLIC_SUBFACILITY_REVIEW_ONLY", "ADDRESS_MATCH", "GEO_NEAR", "NAME_SIMILAR"])
    );
  });

  it("treats traffic safety experience aliases as generic public activity review signals", () => {
    expect(duplicateWeakThematicSimilarityReviewOnly("광주광역시교통문화연수원 어린이 교통안전체험", "어린이 안전체험관")).toBe(true);
    expect(
      duplicateGenericAliasReviewOnly(
        "광주광역시교통문화연수원 어린이 교통안전체험",
        ["광주광역시교통문화연수원"],
        "북구 어린이 교통공원",
        ["교통문화연수원 어린이 안전체험"],
        ["교통문화연수원", "안전체험"]
      )
    ).toBe(true);
  });

  it("treats exact self-check signals as high confidence", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      regionMatch: true,
      sameSigunguMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      nameSimilarity: 1,
      radiusMeters: 500
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ADDRESS_MATCH", "GEO_NEAR", "NAME_SIMILAR"]));
  });

  it("keeps same-region name matches at medium confidence without address", () => {
    const signals = {
      aliasMatch: false,
      regionMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.7
    };

    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReasonCodes(signals)).toContain("REGION_MATCH");
  });

  it("keeps unrelated nearby food branch candidates as manual review", () => {
    const signals = {
      aliasMatch: false,
      addressMatch: true,
      unrelatedBranchCategoryReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 45,
      nameSimilarity: 0.42
    };

    expect(duplicateUnrelatedBranchCategoryReviewOnly("노원구육아종합지원센터 놀이아띠 공릉점", "미랑샤브 노원본점")).toBe(true);
    expect(duplicateUnrelatedBranchCategoryReviewOnly("미랑샤브 노원본점", "미랑샤브 노원본점")).toBe(false);
    expect(duplicateUnrelatedBranchCategoryReviewOnly("미랑샤브 노원본점", "미랑샤브 공릉점")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ADDRESS_MATCH", "UNRELATED_BRANCH_CATEGORY_REVIEW_ONLY", "GEO_NEAR"]));
  });

  it("lowers generic branch-name candidates when source-backed regions conflict", () => {
    const signals = {
      aliasMatch: false,
      addressRegionConflict: true,
      genericBranchName: true,
      regionMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.72
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["GENERIC_BRANCH_NAME", "REGION_MATCH", "ADDRESS_REGION_CONFLICT"]));
  });

  it("buckets same-sido generic public institutions as review-only noise", () => {
    const signals = {
      aliasMatch: false,
      regionMatch: true,
      sameSidoGenericReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 82000,
      radiusMeters: 500,
      nameSimilarity: 0.58
    };

    expect(
      duplicateSameSidoGenericReviewOnly("충청북도교육문화원", "충주교육문화원", {
        regionMatch: true,
        sameSigunguMatch: false,
        distanceMeters: 82000,
        radiusMeters: 500
      })
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "REGION_MATCH",
        "SAME_SIDO_GENERIC_REVIEW_ONLY",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps cross-district public subfacility noise as manual review instead of a hard hold", () => {
    const signals = {
      aliasMatch: false,
      regionMatch: true,
      addressRegionConflict: true,
      publicSubfacilityReviewOnly: true,
      sameSidoGenericReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 24000,
      radiusMeters: 800,
      nameSimilarity: 0.6
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBeNull();
  });

  it("does not hard-hold cross-region public subfacility alias noise", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      addressRegionConflict: true,
      publicSubfacilityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      radiusMeters: null,
      nameSimilarity: 0.62
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateRelationshipHint(signals)).toBeNull();
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining(["ALIAS_MATCH", "PUBLIC_SUBFACILITY_REVIEW_ONLY", "REGION_MATCH", "ADDRESS_REGION_CONFLICT", "NAME_SIMILAR"])
    );
  });

  it("keeps generic activity matches outside the source region as noisy manual review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      addressRegionConflict: true,
      weakThematicSimilarityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 42000,
      radiusMeters: 800,
      nameSimilarity: 0.58
    };

    expect(duplicateWeakThematicSimilarityReviewOnly("고양 물놀이터", "부천 물놀이터")).toBe(true);
    expect(duplicateWeakThematicSimilarityReviewOnly("서구 어린이자료실", "동래구 어린이자료실")).toBe(true);
    expect(duplicateWeakThematicSimilarityReviewOnly("고양 물놀이터", "고양 물놀이터")).toBe(false);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "WEAK_THEMATIC_SIMILARITY_REVIEW_ONLY",
        "REGION_MATCH",
        "ADDRESS_REGION_CONFLICT",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("keeps public generic alias matches outside the source district as noisy manual review", () => {
    const signals = {
      aliasMatch: true,
      regionMatch: true,
      addressRegionConflict: true,
      genericAliasReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 14200,
      radiusMeters: 500,
      nameSimilarity: 0.72
    };

    expect(
      duplicateGenericAliasReviewOnly(
        "수성구육아종합지원센터 장난감도서관",
        undefined,
        "달서아이꿈센터",
        ["달서아이꿈센터 장난감도서관"],
        ["육아종합지원센터", "장난감도서관"]
      )
    ).toBe(true);
    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateOutsideRadiusReviewOnly(signals)).toBe(true);
    expect(duplicateSuggestedAction(signals)).toBe("manual_duplicate_review");
    expect(duplicateReviewBucket(signals)).toBe("low_priority_noise");
    expect(duplicateReasonCodes(signals)).toEqual(
      expect.arrayContaining([
        "ALIAS_MATCH",
        "GENERIC_ALIAS_REVIEW_ONLY",
        "REGION_MATCH",
        "ADDRESS_REGION_CONFLICT",
        "GEO_OUTSIDE_REQUEST_RADIUS",
        "OUTSIDE_RADIUS_REVIEW_ONLY",
        "NAME_SIMILAR"
      ])
    );
  });

  it("lets same-address public generic alias matches stay actionable", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      genericAliasReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      radiusMeters: 500,
      nameSimilarity: 0.72
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
    expect(duplicateReviewBucket(signals)).toBe("identity");
  });

  it("lets same-address generic activity matches stay actionable", () => {
    const signals = {
      aliasMatch: true,
      addressMatch: true,
      weakThematicSimilarityReviewOnly: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: 0,
      radiusMeters: 800,
      nameSimilarity: 0.62
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateSuggestedAction(signals)).toBe("update_existing");
  });

  it("does not bucket exact or same-district public institution matches as same-sido generic noise", () => {
    expect(
      duplicateSameSidoGenericReviewOnly("충청북도교육문화원", "충청북도교육문화원", {
        regionMatch: true,
        sameSigunguMatch: false,
        distanceMeters: 82000,
        radiusMeters: 500
      })
    ).toBe(false);
    expect(
      duplicateSameSidoGenericReviewOnly("충주교육문화원", "충주교육문화원 분원", {
        regionMatch: true,
        sameSigunguMatch: true,
        distanceMeters: null,
        radiusMeters: null
      })
    ).toBe(false);
  });

  it("allows generic branch-name candidates with strict same-district evidence", () => {
    const signals = {
      aliasMatch: false,
      genericBranchName: true,
      regionMatch: true,
      sameSigunguMatch: true,
      externalRefsMatch: false,
      kakaoPlaceIdMatch: false,
      distanceMeters: null,
      nameSimilarity: 0.72
    };

    expect(duplicateConfidence(signals)).toBe("medium");
    expect(duplicateReasonCodes(signals)).toContain("GENERIC_BRANCH_NAME");
  });

  it("detects address-region conflicts from normalized region and address tokens", () => {
    const signals = duplicateLocationSignals(
      {
        address: "부산광역시 동구 초량동",
        regionSido: "부산",
        regionSigungu: "동구",
        radiusMeters: 500
      },
      {
        address: "대전광역시 동구 가양동",
        addressMatch: false,
        distanceMeters: null,
        regionMatch: false,
        regionSido: "대전광역시",
        regionSigungu: "동구"
      }
    );

    expect(signals).toEqual({
      addressRegionConflict: true,
      sameSigunguMatch: false
    });
    expect(duplicateGenericBranchName("맛나감자탕 초량점", "이바돔감자탕 가양점")).toBe(true);
  });
});
