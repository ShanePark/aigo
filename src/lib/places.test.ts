import { describe, expect, it } from "vitest";

import { searchTermPatterns } from "@/lib/places";

describe("place search helpers", () => {
  it("splits spaced Korean queries into AND-able ilike patterns", () => {
    expect(searchTermPatterns("보문산 전망대")).toEqual(["%보문산%", "%전망대%"]);
  });

  it("collapses repeated whitespace in keyword queries", () => {
    expect(searchTermPatterns("  대청호   명상정원  ")).toEqual(["%대청호%", "%명상정원%"]);
  });
});
