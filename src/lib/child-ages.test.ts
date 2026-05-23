import { describe, expect, it } from "vitest";

import { childProfilesToAgeMonths, parseChildAgeMonths, parseChildProfiles } from "@/lib/child-ages";

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

describe("parseChildProfiles", () => {
  it("uses the default preschool child profile bands", () => {
    expect(parseChildProfiles(undefined)).toEqual([
      { ageBand: "24-48", gender: "boy" },
      { ageBand: "6-12", gender: "girl" }
    ]);
  });

  it("derives profile bands from legacy exact age params", () => {
    expect(parseChildProfiles(undefined, "32,7,7")).toEqual([
      { ageBand: "6-12", gender: "girl" },
      { ageBand: "24-48", gender: "boy" }
    ]);
  });

  it("keeps gender-specific profiles while using one representative search age per band", () => {
    const profiles = parseChildProfiles("boy:6-12,girl:6-12,boy:48-84");

    expect(profiles).toEqual([
      { ageBand: "6-12", gender: "boy" },
      { ageBand: "6-12", gender: "girl" },
      { ageBand: "48-84", gender: "boy" }
    ]);
    expect(childProfilesToAgeMonths(profiles)).toEqual([7, 60]);
  });
});
