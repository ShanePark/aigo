import { serializeChildAgeMonths, serializeChildProfiles, type ChildGender, type ChildProfile } from "@/lib/child-ages";

import { ageMonthsFromBirthYearMonth, childAgeBandIdFromBirthYearMonth } from "./me-profile-utils";

type Params = Record<string, string | string[] | undefined>;

export type ChildParamSource = "account" | "none" | "url";

export type AccountChildDefaultResult = {
  childParamSource: ChildParamSource;
  params: Params;
};

export function applyAccountChildDefaults(
  params: Params,
  children: readonly { birthYearMonth: string; gender?: ChildGender }[],
  now = new Date()
): AccountChildDefaultResult {
  if (hasExplicitChildParams(params)) {
    return { childParamSource: "url", params };
  }

  const ageMonths = accountChildAgeMonths(children, now);
  const childProfiles = accountChildProfiles(children, now);
  if (ageMonths.length === 0 || childProfiles.length === 0) {
    return { childParamSource: "none", params };
  }

  return {
    childParamSource: "account",
    params: {
      ...params,
      children: serializeChildProfiles(childProfiles),
      ages: serializeChildAgeMonths(ageMonths)
    }
  };
}

export function accountChildAgeMonths(children: readonly { birthYearMonth: string }[], now = new Date()) {
  return children
    .map((child) => ageMonthsFromBirthYearMonth(child.birthYearMonth, now))
    .filter((ageMonths): ageMonths is number => ageMonths !== null);
}

export function accountChildProfiles(children: readonly { birthYearMonth: string; gender?: ChildGender }[], now = new Date()): ChildProfile[] {
  return children.flatMap((child) => {
    const ageMonths = ageMonthsFromBirthYearMonth(child.birthYearMonth, now);
    if (ageMonths === null) return [];

    return [
      {
        ageBand: childAgeBandIdFromBirthYearMonth(child.birthYearMonth, now),
        gender: child.gender ?? "boy"
      }
    ];
  });
}

export function childParamSourceForParams(params: Params): ChildParamSource {
  return hasExplicitChildParams(params) ? "url" : "none";
}

function hasExplicitChildParams(params: Params) {
  return hasParamValue(params.children) || hasParamValue(params.ages);
}

function hasParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.some((item) => item.trim().length > 0);
  return Boolean(value?.trim());
}
