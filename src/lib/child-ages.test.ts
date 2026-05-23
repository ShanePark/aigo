import { describe, expect, it } from "vitest";

import { parseChildAgeMonths } from "@/lib/child-ages";

describe("parseChildAgeMonths", () => {
  it("uses the default child age set without duplicate twin ages", () => {
    expect(parseChildAgeMonths(undefined)).toEqual([32, 7]);
  });

  it("deduplicates repeated age months from params", () => {
    expect(parseChildAgeMonths("32,7,7")).toEqual([32, 7]);
  });

  it("allows an explicit empty child-age filter", () => {
    expect(parseChildAgeMonths("none")).toEqual([]);
  });
});
