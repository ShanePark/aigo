export const DEFAULT_CHILD_AGE_MONTHS = [32, 7] as const;
export const MAX_CHILD_AGE_MONTHS = 240;

export type ChildAgeStage = "infant" | "preschooler" | "toddler";

export function parseChildAgeMonths(value: string | null | undefined): number[] {
  const source = value && value.trim().length > 0 ? value : DEFAULT_CHILD_AGE_MONTHS.join(",");
  const ages = source
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= MAX_CHILD_AGE_MONTHS);

  return Array.from(new Set(ages)).slice(0, 10);
}

export function childAgeStage(ageMonths: number): ChildAgeStage {
  if (ageMonths < 12) return "infant";
  if (ageMonths < 36) return "toddler";
  return "preschooler";
}

export function childAgeStageLabel(ageMonths: number) {
  const stage = childAgeStage(ageMonths);
  if (stage === "infant") return "쪽쪽이 시기";
  if (stage === "toddler") return "아장아장";
  return "활동 많은 아이";
}

export function formatChildAge(ageMonths: number) {
  return `${ageMonths}개월`;
}
