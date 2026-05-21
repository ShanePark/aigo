import { describe, expect, it } from "vitest";

import { duplicateConfidence, duplicateReasonCodes } from "@/lib/duplicates";

describe("duplicate helpers", () => {
  it("treats kakao place id match as high confidence", () => {
    const signals = {
      kakaoPlaceIdMatch: true,
      distanceMeters: 2000,
      nameSimilarity: 0.1
    };

    expect(duplicateConfidence(signals)).toBe("high");
    expect(duplicateReasonCodes(signals)).toContain("KAKAO_PLACE_ID_MATCH");
  });

  it("does not mark same-name far-away places as high confidence without external id", () => {
    const signals = {
      kakaoPlaceIdMatch: false,
      distanceMeters: 8000,
      nameSimilarity: 0.9
    };

    expect(duplicateConfidence(signals)).toBe("low");
    expect(duplicateReasonCodes(signals)).toContain("NAME_SIMILAR");
    expect(duplicateReasonCodes(signals)).not.toContain("GEO_NEAR");
  });
});

