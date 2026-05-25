import { describe, expect, it } from "vitest";

import { accountChildAgeMonths, applyAccountChildDefaults, applyAccountSearchPreferenceDefaults, childParamSourceForParams } from "@/app/account-child-defaults";

const now = new Date("2026-05-25T12:00:00+09:00");

describe("account child defaults", () => {
  it("applies account child ages when the URL has no child params", () => {
    expect(
      applyAccountChildDefaults(
        { query: "키즈카페" },
        [
          { birthYearMonth: "2023-09" },
          { birthYearMonth: "2025-10" }
        ],
        now
      )
    ).toEqual({
      childParamSource: "account",
      params: {
        query: "키즈카페",
        ages: "32,7"
      }
    });
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

describe("account search preference defaults", () => {
  it("applies saved search preferences when URL params are absent", () => {
    expect(
      applyAccountSearchPreferenceDefaults(
        { query: "실내" },
        {
          preferIndoor: true,
          preferParking: false,
          preferStroller: true,
          preferSandPlay: true,
          preferNursing: false,
          preferBabyChair: true,
          preferenceMode: "required"
        }
      )
    ).toEqual({
      preferenceParamSource: "account",
      params: {
        query: "실내",
        indoor: "on",
        stroller: "on",
        sandPlay: "on",
        babyChair: "on",
        preferenceMode: "required"
      }
    });
  });

  it("keeps explicit URL preference params above saved defaults per key", () => {
    expect(
      applyAccountSearchPreferenceDefaults(
        { indoor: "off", preferenceMode: "soft" },
        {
          preferIndoor: true,
          preferParking: true,
          preferStroller: false,
          preferSandPlay: false,
          preferNursing: false,
          preferBabyChair: false,
          preferenceMode: "required"
        }
      )
    ).toEqual({
      preferenceParamSource: "account",
      params: {
        indoor: "off",
        parking: "on",
        preferenceMode: "soft"
      }
    });
  });

  it("reports URL preference source when explicit params exist and nothing is applied", () => {
    expect(
      applyAccountSearchPreferenceDefaults(
        { nursing: "off" },
        {
          preferIndoor: false,
          preferParking: false,
          preferStroller: false,
          preferSandPlay: false,
          preferNursing: true,
          preferBabyChair: false,
          preferenceMode: "soft"
        }
      )
    ).toEqual({
      preferenceParamSource: "url",
      params: {
        nursing: "off"
      }
    });
  });
});
