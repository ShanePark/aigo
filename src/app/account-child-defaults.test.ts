import { describe, expect, it } from "vitest";

import {
  accountChildAgeMonths,
  accountChildProfiles,
  applyAccountChildDefaults,
  childParamSourceForParams
} from "@/app/account-child-defaults";

const now = new Date("2026-05-25T12:00:00+09:00");

describe("account child defaults", () => {
  it("applies account child ages when the URL has no child params", () => {
    expect(
      applyAccountChildDefaults(
        { query: "키즈카페" },
        [
          { birthYearMonth: "2023-09", gender: "girl" },
          { birthYearMonth: "2025-10", gender: "boy" }
        ],
        now
      )
    ).toEqual({
      childParamSource: "account",
      params: {
        query: "키즈카페",
        children: "boy:6-12,girl:24-48",
        ages: "32,7"
      }
    });
  });

  it("maps account child birth months and saved gender to search profiles", () => {
    expect(
      accountChildProfiles(
        [
          { birthYearMonth: "2025-10", gender: "girl" },
          { birthYearMonth: "2023-09", gender: "boy" }
        ],
        now
      )
    ).toEqual([
      { ageBand: "6-12", gender: "girl" },
      { ageBand: "24-48", gender: "boy" }
    ]);
  });

  it("keeps URL child params above account defaults", () => {
    expect(applyAccountChildDefaults({ ages: "12", query: "실내" }, [{ birthYearMonth: "2025-10" }], now)).toEqual({
      childParamSource: "url",
      params: { ages: "12", query: "실내" }
    });
    expect(applyAccountChildDefaults({ children: "none" }, [{ birthYearMonth: "2025-10" }], now)).toEqual({
      childParamSource: "url",
      params: { children: "none" }
    });
  });

  it("ignores invalid or future birth months", () => {
    expect(accountChildAgeMonths([{ birthYearMonth: "bad" }, { birthYearMonth: "2999-01" }, { birthYearMonth: "2025-10" }], now)).toEqual([7]);
    expect(applyAccountChildDefaults({}, [{ birthYearMonth: "bad" }], now)).toEqual({
      childParamSource: "none",
      params: {}
    });
  });

  it("identifies explicit child params without account data", () => {
    expect(childParamSourceForParams({})).toBe("none");
    expect(childParamSourceForParams({ children: ["", "boy:6-12"] })).toBe("url");
  });
});
