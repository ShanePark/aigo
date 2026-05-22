import { describe, expect, it } from "vitest";

import { duplicateConfidence, duplicateReasonCodes } from "@/lib/duplicates";

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
      nameSimilarity: 0.9
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateReasonCodes(signals)).toContain("NAME_SIMILAR");
    expect(duplicateReasonCodes(signals)).not.toContain("GEO_NEAR");
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
});
