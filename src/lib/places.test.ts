import { describe, expect, it } from "vitest";

import { isBroadNatureIntentQuery, queryMatchSignal, searchTermPatterns, shouldSearchAddressForTerm } from "@/lib/places";

describe("place search helpers", () => {
  it("splits spaced Korean queries into AND-able ilike patterns", () => {
    expect(searchTermPatterns("보문산 전망대")).toEqual(["%보문산%", "%전망대%"]);
  });

  it("collapses repeated whitespace in keyword queries", () => {
    expect(searchTermPatterns("  대청호   명상정원  ")).toEqual(["%대청호%", "%명상정원%"]);
  });

  it("recognizes broad nature intent queries", () => {
    expect(isBroadNatureIntentQuery("공원 자연")).toBe(true);
    expect(isBroadNatureIntentQuery("숲 산책")).toBe(true);
    expect(isBroadNatureIntentQuery("대청호 자연")).toBe(false);
  });

  it("does not use short region-like terms against address text", () => {
    expect(shouldSearchAddressForTerm("계룡", "계룡")).toBe(false);
  });

  it("uses address text for address-shaped queries", () => {
    expect(shouldSearchAddressForTerm("계룡로 598", "계룡로")).toBe(true);
    expect(shouldSearchAddressForTerm("대전로", "대전로")).toBe(false);
    expect(shouldSearchAddressForTerm("대전광역시", "대전광역시")).toBe(true);
  });

  it("boosts direct place-name keyword matches over tag-only matches", () => {
    const nameMatch = queryMatchSignal(
      {
        name: "공주산림휴양마을 목재문화체험장",
        tags: ["woodcraft"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );
    const tagMatch = queryMatchSignal(
      {
        name: "금산산림문화타운",
        tags: ["목재문화체험장"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );

    expect(nameMatch.delta).toBeGreaterThan(tagMatch.delta);
    expect(nameMatch.reasonCodes).toContain("QUERY_NAME_MATCH");
    expect(tagMatch.reasonCodes).toContain("QUERY_TAG_MATCH");
  });

  it("does not add literal query boosts for broad nature intent queries", () => {
    const signal = queryMatchSignal(
      {
        name: "세종호수공원",
        tags: ["공원", "자연"],
        description: "넓은 자연 산책 공원",
        address: null,
        roadAddress: null
      },
      "공원 자연"
    );

    expect(signal.delta).toBe(0);
    expect(signal.reasonCodes).toEqual([]);
  });
});
