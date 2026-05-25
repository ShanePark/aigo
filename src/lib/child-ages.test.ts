import { describe, expect, it } from "vitest";

import { childProfilesToAgeMonths, parseChildAgeMonths, parseChildProfiles } from "@/lib/child-ages";

describe("parseChildAgeMonths", () => {
  it("does not assume child ages before the user chooses them", () => {
    expect(parseChildAgeMonths(undefined)).toEqual([]);
  });

  it("preserves repeated age months from params", () => {
    expect(parseChildAgeMonths("32,7,7")).toEqual([32, 7, 7]);
  });

  it("allows an explicit empty child-age filter", () => {
    expect(parseChildAgeMonths("none")).toEqual([]);
  });
});

describe("parseChildProfiles", () => {
  it("does not assume child profiles before the user chooses them", () => {
    expect(parseChildProfiles(undefined)).toEqual([]);
  });

  it("derives profile bands from legacy exact age params", () => {
    expect(parseChildProfiles(undefined, "32,7,7")).toEqual([
      { ageBand: "24-48", gender: "boy" },
      { ageBand: "6-12", gender: "girl" },
      { ageBand: "6-12", gender: "boy" }
    ]);
  });

  it("keeps duplicate child profiles and search ages", () => {
    const profiles = parseChildProfiles("boy:6-12,boy:6-12,girl:6-12,boy:48-84");

    expect(profiles).toEqual([
      { ageBand: "6-12", gender: "boy" },
      { ageBand: "6-12", gender: "boy" },
      { ageBand: "6-12", gender: "girl" },
      { ageBand: "48-84", gender: "boy" }
    ]);
    expect(childProfilesToAgeMonths(profiles)).toEqual([7, 7, 7, 60]);
  });
});
