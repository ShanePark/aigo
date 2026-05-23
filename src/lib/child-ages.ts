export const CHILD_AGE_BANDS = [
  { id: "under6", label: "6개월 이하", shortLabel: "~6개월", ageMonths: 4, tone: "blue" },
  { id: "6-12", label: "6~12개월", shortLabel: "6~12개월", ageMonths: 7, tone: "mint" },
  { id: "12-24", label: "12~24개월", shortLabel: "12~24개월", ageMonths: 18, tone: "yellow" },
  { id: "24-48", label: "24~48개월", shortLabel: "24~48개월", ageMonths: 32, tone: "coral" },
  { id: "48-84", label: "48개월~7세", shortLabel: "48개월~7세", ageMonths: 60, tone: "blue" }
] as const;

export const CHILD_GENDERS = [
  { id: "boy", label: "남아" },
  { id: "girl", label: "여아" }
] as const;

export const DEFAULT_CHILD_PROFILES = [
  { gender: "boy", ageBand: "24-48" },
  { gender: "girl", ageBand: "6-12" }
] as const satisfies readonly ChildProfile[];

export const DEFAULT_CHILD_AGE_MONTHS = [32, 7] as const;
export const MAX_CHILD_AGE_MONTHS = 240;

export type ChildAgeBandId = (typeof CHILD_AGE_BANDS)[number]["id"];
export type ChildGender = (typeof CHILD_GENDERS)[number]["id"];
export type ChildProfile = {
  ageBand: ChildAgeBandId;
  gender: ChildGender;
};

export function parseChildAgeMonths(value: string | null | undefined): number[] {
  const source = value && value.trim().length > 0 ? value : DEFAULT_CHILD_AGE_MONTHS.join(",");
  const ages = source
    .split(",")
    .map((age) => Number(age.trim()))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= MAX_CHILD_AGE_MONTHS);

  return Array.from(new Set(ages)).slice(0, 10);
}

export function parseChildProfiles(childrenValue: string | null | undefined, ageValue?: string | null | undefined): ChildProfile[] {
  if (childrenValue && childrenValue.trim().length > 0) {
    if (childrenValue.trim() === "none") return [];
    return normalizeChildProfiles(
      childrenValue
        .split(",")
        .map((item) => {
          const [gender, ageBand] = item.trim().split(":");
          return isChildGender(gender) && isChildAgeBandId(ageBand) ? { gender, ageBand } : null;
        })
        .filter((profile): profile is ChildProfile => profile !== null)
    );
  }

  if (ageValue && ageValue.trim().length > 0) {
    return profilesFromAgeMonths(parseChildAgeMonths(ageValue));
  }

  return [...DEFAULT_CHILD_PROFILES];
}

export function normalizeChildProfiles(profiles: readonly ChildProfile[]): ChildProfile[] {
  const byBand = new Map<ChildAgeBandId, ChildProfile>();
  for (const profile of profiles) {
    if (isChildGender(profile.gender) && isChildAgeBandId(profile.ageBand)) {
      byBand.set(profile.ageBand, { ageBand: profile.ageBand, gender: profile.gender });
    }
  }

  return CHILD_AGE_BANDS.map((band) => byBand.get(band.id)).filter((profile): profile is ChildProfile => Boolean(profile));
}

export function profilesFromAgeMonths(ages: readonly number[]): ChildProfile[] {
  return normalizeChildProfiles(
    ages.map((age, index) => ({
      ageBand: childAgeBandForMonths(age).id,
      gender: index % 2 === 0 ? "boy" : "girl"
    }))
  );
}

export function childProfilesToAgeMonths(profiles: readonly ChildProfile[]): number[] {
  return normalizeChildProfiles(profiles).map((profile) => childAgeBandById(profile.ageBand).ageMonths);
}

export function serializeChildProfiles(profiles: readonly ChildProfile[]) {
  const normalized = normalizeChildProfiles(profiles);
  return normalized.length > 0 ? normalized.map((profile) => `${profile.gender}:${profile.ageBand}`).join(",") : "none";
}

export function serializeChildAgeMonths(ages: readonly number[]) {
  return ages.length > 0 ? ages.join(",") : "none";
}

export function childAgeBandById(id: ChildAgeBandId) {
  return CHILD_AGE_BANDS.find((band) => band.id === id) ?? CHILD_AGE_BANDS[0];
}

export function childAgeBandForMonths(ageMonths: number) {
  if (ageMonths <= 6) return childAgeBandById("under6");
  if (ageMonths <= 12) return childAgeBandById("6-12");
  if (ageMonths <= 24) return childAgeBandById("12-24");
  if (ageMonths <= 48) return childAgeBandById("24-48");
  return childAgeBandById("48-84");
}

export function childGenderLabel(gender: ChildGender) {
  return CHILD_GENDERS.find((item) => item.id === gender)?.label ?? "아이";
}

export function formatChildProfile(profile: ChildProfile) {
  return `${childGenderLabel(profile.gender)} ${childAgeBandById(profile.ageBand).shortLabel}`;
}

function isChildGender(value: string | undefined): value is ChildGender {
  return CHILD_GENDERS.some((gender) => gender.id === value);
}

function isChildAgeBandId(value: string | undefined): value is ChildAgeBandId {
  return CHILD_AGE_BANDS.some((band) => band.id === value);
}
