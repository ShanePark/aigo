import { serializeChildAgeMonths, serializeChildProfiles, type ChildGender, type ChildProfile } from "@/lib/child-ages";
import type { MyProfileSearchPreferences } from "@/lib/user-profile";

import { ageMonthsFromBirthYearMonth, childAgeBandIdFromBirthYearMonth } from "./me-profile-utils";

type Params = Record<string, string | string[] | undefined>;

export type ChildParamSource = "account" | "none" | "url";
export type SearchPreferenceParamSource = "account" | "none" | "url";

export type AccountChildDefaultResult = {
  childParamSource: ChildParamSource;
  params: Params;
};

export type AccountSearchPreferenceDefaultResult = {
  params: Params;
  preferenceParamSource: SearchPreferenceParamSource;
};

const SEARCH_PREFERENCE_PARAMS = [
  ["preferIndoor", "indoor"],
  ["preferParking", "parking"],
  ["preferStroller", "stroller"],
  ["preferSandPlay", "sandPlay"],
  ["preferNursing", "nursing"],
  ["preferBabyChair", "babyChair"]
] as const satisfies ReadonlyArray<[Exclude<keyof MyProfileSearchPreferences, "preferenceMode">, string]>;

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

export function applyAccountSearchPreferenceDefaults(
  params: Params,
  preferences: MyProfileSearchPreferences
): AccountSearchPreferenceDefaultResult {
  let applied = false;
  let hasExplicitParam = false;
  const next = { ...params };

  for (const [profileKey, paramKey] of SEARCH_PREFERENCE_PARAMS) {
    if (hasParamValue(params[paramKey])) {
      hasExplicitParam = true;
      continue;
    }

    if (preferences[profileKey]) {
      next[paramKey] = "on";
      applied = true;
    }
  }

  if (hasParamValue(params.preferenceMode)) {
    hasExplicitParam = true;
  } else if (preferences.preferenceMode === "required") {
    next.preferenceMode = "required";
    applied = true;
  }

  return {
    params: applied ? next : params,
    preferenceParamSource: applied ? "account" : hasExplicitParam ? "url" : "none"
  };
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
