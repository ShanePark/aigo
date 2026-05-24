import { describe, expect, it } from "vitest";

import {
  placeQualityScoreLabel,
  placeQualityScoreTitle,
  resultScoreRowLabel,
  searchRelevanceScoreLabel,
  searchRelevanceScoreTitle
} from "@/app/result-score-labels";

describe("result score labels", () => {
  it("keeps visible score labels compact and distinct", () => {
    expect(searchRelevanceScoreLabel(56)).toBe("관련도 56");
    expect(placeQualityScoreLabel(88)).toBe("평가 88");
  });

  it("describes what each score means for assistive labels and tooltips", () => {
    expect(searchRelevanceScoreTitle(56)).toBe("현재 검색 조건 기준 관련도 56점");
    expect(placeQualityScoreTitle(88)).toBe("장소 자체 평가 점수 88점");
    expect(resultScoreRowLabel(56, 88)).toBe("현재 검색 조건 기준 관련도 56점, 장소 자체 평가 점수 88점");
  });

  it("omits the place quality phrase when the API does not provide it", () => {
    expect(resultScoreRowLabel(56, null)).toBe("현재 검색 조건 기준 관련도 56점");
    expect(resultScoreRowLabel(56)).toBe("현재 검색 조건 기준 관련도 56점");
  });
});
