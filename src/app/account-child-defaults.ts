import { serializeChildAgeMonths } from "@/lib/child-ages";

import { ageMonthsFromBirthYearMonth } from "./me-profile-utils";

type Params = Record<string, string | string[] | undefined>;

export type ChildParamSource = "account" | "none" | "url";

export type AccountChildDefaultResult = {
  childParamSource: ChildParamSource;
  params: Params;
};

export function applyAccountChildDefaults(
  params: Params,
  children: readonly { birthYearMonth: string }[],
  now = new Date()
): AccountChildDefaultResult {
  if (hasExplicitChildParams(params)) {
    return { childParamSource: "url", params };
  }

  const ageMonths = accountChildAgeMonths(children, now);
  if (ageMonths.length === 0) {
    return { childParamSource: "none", params };
  }

  return {
    childParamSource: "account",
    params: {
      ...params,
      ages: serializeChildAgeMonths(ageMonths)
    }
  };
}

export function accountChildAgeMonths(children: readonly { birthYearMonth: string }[], now = new Date()) {
  return children
    .map((child) => ageMonthsFromBirthYearMonth(child.birthYearMonth, now))
    .filter((ageMonths): ageMonths is number => ageMonths !== null);
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
