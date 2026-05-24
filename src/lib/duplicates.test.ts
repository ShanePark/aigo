import { describe, expect, it } from "vitest";

import {
  duplicateConfidence,
  duplicateGenericBranchName,
  duplicateLocationSignals,
  duplicateOutsideRadiusReviewOnly,
  duplicateReasonCodes,
  duplicateSameBuildingReviewOnly
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
  });

  it("downgrades outside-radius alias and region matches to review-only", () => {
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
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ALIAS_MATCH", "REGION_MATCH", "GEO_OUTSIDE_REQUEST_RADIUS", "OUTSIDE_RADIUS_REVIEW_ONLY", "NAME_SIMILAR"]));
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
    expect(duplicateReasonCodes(signals)).toEqual(expect.arrayContaining(["ADDRESS_MATCH", "SAME_BUILDING_REVIEW_ONLY", "GEO_NEAR"]));
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
    expect(duplicateReasonCodes(signals)).toContain("REGION_MATCH");
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
