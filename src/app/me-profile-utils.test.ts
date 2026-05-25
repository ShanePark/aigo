import { describe, expect, it } from "vitest";

import {
  ageMonthsFromBirthYearMonth,
  childAgeBandIdFromBirthYearMonth,
  childAgeLabelFromBirthYearMonth,
  childProfileIconSrcFromBirthYearMonth,
  currentYearMonth
} from "@/app/me-profile-utils";

const now = new Date("2026-05-25T12:00:00+09:00");

describe("me profile helpers", () => {
  it("formats the current year-month in the Seoul timezone", () => {
    expect(currentYearMonth(now)).toBe("2026-05");
  });

  it("calculates age months and labels from a saved birth month", () => {
    expect(ageMonthsFromBirthYearMonth("2025-10", now)).toBe(7);
    expect(childAgeLabelFromBirthYearMonth("2025-10", now)).toBe("7개월");
    expect(childAgeLabelFromBirthYearMonth("2023-09", now)).toBe("2세 8개월");
  });

  it("maps birth months to the existing child age band icons", () => {
    expect(childAgeBandIdFromBirthYearMonth("2025-10", now)).toBe("6-12");
    expect(childAgeBandIdFromBirthYearMonth("2023-09", now)).toBe("24-48");
    expect(childProfileIconSrcFromBirthYearMonth("2023-09", "girl", now)).toBe("/icons/child-profiles/girl-24-48-avatar.webp");
  });

  it("keeps invalid or future birth months safe for display", () => {
    expect(ageMonthsFromBirthYearMonth("bad", now)).toBeNull();
    expect(ageMonthsFromBirthYearMonth("2999-01", now)).toBeNull();
    expect(childAgeLabelFromBirthYearMonth("2999-01", now)).toBe("생년월 확인");
  });
});
