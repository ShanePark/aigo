export const ACCOMMODATION_CATEGORY = {
  id: "accommodation",
  label: "숙박",
  depth: 1
} as const;

export const ACCOMMODATION_TYPES = [
  {
    id: "resort",
    parentCategory: ACCOMMODATION_CATEGORY.id,
    depth: 2,
    iconCategory: "accommodation_resort",
    label: "리조트",
    tagAliases: ["resort", "lodging_resort", "family_resort", "kids_resort", "리조트", "키즈리조트"]
  },
  {
    id: "poolVilla",
    parentCategory: ACCOMMODATION_CATEGORY.id,
    depth: 2,
    iconCategory: "accommodation_pool_villa",
    label: "풀빌라",
    tagAliases: ["pool_villa", "poolvilla", "private_pool_villa", "풀빌라", "키즈풀빌라"]
  },
  {
    id: "kidsHotel",
    parentCategory: ACCOMMODATION_CATEGORY.id,
    depth: 2,
    iconCategory: "accommodation_kids_hotel",
    label: "키즈호텔",
    tagAliases: ["kids_hotel", "kid_hotel", "children_hotel", "키즈호텔", "키즈 호텔"]
  },
  {
    id: "pension",
    parentCategory: ACCOMMODATION_CATEGORY.id,
    depth: 2,
    iconCategory: "accommodation_pension",
    label: "펜션",
    tagAliases: ["pension", "family_pension", "kids_pension", "펜션", "키즈펜션"]
  }
] as const;

export type AccommodationTypeId = (typeof ACCOMMODATION_TYPES)[number]["id"];

const ACCOMMODATION_TYPE_BY_ID = new Map(ACCOMMODATION_TYPES.map((type) => [type.id, type]));
const ACCOMMODATION_TYPE_ALIASES = new Map(
  ACCOMMODATION_TYPES.flatMap((type) => type.tagAliases.map((alias) => [normalizeAccommodationText(alias), type] as const))
);

export function accommodationTypeById(value: string | null | undefined) {
  return value ? ACCOMMODATION_TYPE_BY_ID.get(value as AccommodationTypeId) ?? null : null;
}

export function accommodationTypeForTags(category: string, tags: readonly string[] | null | undefined) {
  if (category !== "accommodation") return null;
  for (const tag of tags ?? []) {
    const type = ACCOMMODATION_TYPE_ALIASES.get(normalizeAccommodationText(tag));
    if (type) return type;
  }
  return null;
}

export function accommodationTypeForPlace(category: string, place: { name?: string | null; tags?: readonly string[] | null }) {
  const tagType = accommodationTypeForTags(category, place.tags);
  if (tagType || category !== "accommodation") return tagType;

  const name = normalizeAccommodationText(place.name ?? "");
  if (name.includes("풀빌라")) return accommodationTypeById("poolVilla");
  if (name.includes("리조트")) return accommodationTypeById("resort");
  if (name.includes("키즈호텔") || name.includes("호텔")) return accommodationTypeById("kidsHotel");
  if (name.includes("펜션")) return accommodationTypeById("pension");
  return null;
}

export function accommodationHierarchyForPlace(category: string, place: { name?: string | null; tags?: readonly string[] | null }) {
  if (category !== ACCOMMODATION_CATEGORY.id) return null;
  return {
    parent: ACCOMMODATION_CATEGORY,
    subtype: accommodationTypeForPlace(category, place)
  };
}

export function accommodationTypePathLabel(type: Pick<(typeof ACCOMMODATION_TYPES)[number], "label"> | null | undefined) {
  return type ? `${ACCOMMODATION_CATEGORY.label} > ${type.label}` : ACCOMMODATION_CATEGORY.label;
}

export function accommodationTypeTagAliases(value: AccommodationTypeId) {
  return [...(ACCOMMODATION_TYPE_BY_ID.get(value)?.tagAliases ?? [])];
}

function normalizeAccommodationText(value: string) {
  return value.trim().replace(/[-\s]+/g, "_").toLowerCase();
}
